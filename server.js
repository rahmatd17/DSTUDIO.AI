require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const path = require('path');
const config = require('./config');
const gemini = require('./providers/gemini');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50mb' }));

// CORS hanya untuk origin yang diizinkan (default: same-origin saja)
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o && allowed.includes(o)) {
        res.setHeader('Access-Control-Allow-Origin', o);
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Hanya index.html yang disajikan (folder backend & .env tidak ikut terekspos)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

// Rate limit sederhana per IP (tanpa dependensi tambahan)
const hits = new Map();
function rateLimit(max, windowMs) {
    return (req, res, next) => {
        const now = Date.now();
        const arr = (hits.get(req.ip) || []).filter(t => now - t < windowMs);
        if (arr.length >= max) {
            return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan. Tunggu sebentar.' });
        }
        arr.push(now); hits.set(req.ip, arr); next();
    };
}
setInterval(() => hits.clear(), 10 * 60 * 1000).unref();

app.get('/api/health', (req, res) => {
    const p = config[config.active];
    res.json({ status: 'ok', provider: config.active, providerName: p.name, model: p.model, keyReady: !!process.env[p.apiKeyEnv], timestamp: new Date().toISOString() });
});

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const clamp = (v, min, max, def) => Math.min(Math.max(Number(v) || def, min), max);
// Bersihkan objek bebas dari klien: hanya string pendek, jumlah kunci dibatasi
const cleanObj = (o, maxKeys, maxLen) => Object.fromEntries(Object.entries(o && typeof o === 'object' && !Array.isArray(o) ? o : {}).slice(0, maxKeys).map(([k, v]) => [String(k).slice(0, 40), String(v == null ? '' : v).slice(0, maxLen)]));

app.post('/api/generate', rateLimit(12, 60 * 1000), async (req, res) => {
    const b = req.body || {};
    const { prompt, category, categoryName, mode, durasi, aspectRatio, language } = b;

    if (typeof prompt !== 'string' || prompt.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Prompt wajib diisi minimal 3 karakter.' });
    }
    if (prompt.length > 8000) {
        return res.status(400).json({ success: false, error: 'Prompt terlalu panjang (maks 8000 karakter).' });
    }
    if (!config.CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, error: 'Kategori tidak dikenal.' });
    }

    const refs = (Array.isArray(b.references) ? b.references : [])
        .filter(r => r && typeof r.data === 'string' && ALLOWED_MIME.includes(r.mimeType))
        .slice(0, 10)
        .map(r => ({ category: String(r.category || 'ref').slice(0, 40), fileName: String(r.fileName || 'image').slice(0, 80), mimeType: r.mimeType, data: r.data }));
    if (refs.reduce((s, r) => s + r.data.length, 0) > 30 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'Total referensi terlalu besar (maks 30MB).' });
    }

    const adegan = clamp(b.adegan, 1, 10, 2);
    const shotPerAdegan = clamp(b.shotPerAdegan, 1, 6, 5);
    const started = Date.now();
    // Jika klien menutup halaman, hentikan permintaan ke Gemini agar kuota tidak terbuang
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });

    try {
        const systemPrompt = config.buildSystemPrompt({
            ...b, category, adegan, shotPerAdegan,
            totalPart: clamp(b.totalPart, 1, 6, 1),
            part: clamp(b.part, 1, 6, 1),
            lock: String(b.lock || '').slice(0, 4000),
            prevTail: String(b.prevTail || '').slice(-1800),
            lockChars: (Array.isArray(b.lockChars) ? b.lockChars : []).filter(c => c && typeof c === 'object').slice(0, 4).map(c => ({ name: String(c.name || '').slice(0, 40), text: String(c.text || '').slice(0, 1500) })),
            lockLoc: b.lockLoc && b.lockLoc.text ? { name: String(b.lockLoc.name || '').slice(0, 40), text: String(b.lockLoc.text).slice(0, 1500) } : null,
            extras: cleanObj(b.extras, 14, 200),
            charDetails: b.charDetails ? cleanObj(b.charDetails, 16, 200) : null,
            locDetails: b.locDetails ? cleanObj(b.locDetails, 16, 200) : null,
            charCount: clamp(b.charCount, 1, 6, 3),
            hookCount: clamp(b.hookCount, 1, 15, 5),
            titleCount: clamp(b.titleCount, 1, 20, 10),
            hasReferences: refs.length > 0, referenceCount: refs.length
        });

        const out = await gemini.callGemini(prompt.trim(), systemPrompt, refs, ac.signal);
        const result = config.postProcess(out.text, category);
        const duration = ((Date.now() - started) / 1000).toFixed(2);

        const hasImage = /\[IMAGE PROMPT\]/i.test(result);
        const hasVideo = /\[VIDEO PROMPT\]/i.test(result);
        const hasMaster = /###\s*MASTER SCENE/i.test(result);
        const hasNegVideo = /NEGATIVE VIDEO/i.test(result);
        console.log(`✅ [${category}] ${mode} · ${duration}s · ${refs.length} ref · ${result.length} char · master:${hasMaster ? 'ya' : 'TIDAK'} · negVideo:${hasNegVideo ? 'ya' : 'TIDAK'}`);
        if (mode === 'multi' && category !== 'konten-sosmed' && (!hasImage || !hasVideo)) {
            console.warn(`⚠️ Output multi tidak lengkap (image:${hasImage} video:${hasVideo})`);
        }

        res.json({
            success: true, mode: mode || 'multi',
            provider: config.active, providerName: config[config.active].name,
            meta: { category, categoryName, part: clamp(b.part, 1, 6, 1), totalPart: clamp(b.totalPart, 1, 6, 1), adegan, shotPerAdegan, durasi, aspectRatio, language, referenceCount: refs.length },
            duration: duration + 's', result, truncated: !!out.truncated, timestamp: new Date().toISOString()
        });
    } catch (err) {
        if (ac.signal.aborted) { console.log('⏹️ Dibatalkan: klien menutup koneksi'); return; }
        console.error('❌ Error:', err.message);
        const m = err.message || '';
        let friendly = 'Gagal memproses permintaan.';
        if (m.includes('API_KEY')) friendly = 'API key belum diisi di file .env.';
        else if (/^sibuk:/i.test(m)) friendly = 'Server Gemini sedang sangat sibuk (overload). Ini bukan masalah di aplikasi — coba generate lagi dalam 1-2 menit.';
        else if (/api key not valid|API_KEY_INVALID|expired/i.test(m)) friendly = 'API key tidak valid / kedaluwarsa. Buat key baru di aistudio.google.com lalu isi di .env.';
        else if (/quota|RESOURCE_EXHAUSTED/i.test(m)) friendly = 'Kuota Gemini habis. Tunggu atau ganti API key/paket.';
        else if (/location is not supported/i.test(m)) friendly = 'Wilayah tidak didukung oleh Gemini API untuk key ini.';
        else if (m.includes('401') || m.includes('403')) friendly = 'API key tidak valid atau tidak punya akses.';
        else if (m.includes('429')) friendly = 'Kuota/permintaan Gemini habis. Tunggu 1-2 menit.';
        else if (m.toLowerCase().includes('timeout')) friendly = 'Server AI terlalu lama merespon.';
        else if (m.includes('404')) friendly = 'Model tidak ditemukan.';
        else if (m.includes('503')) friendly = 'Server Google sedang sibuk.';
        else if (m.includes('diblokir')) friendly = 'Permintaan diblokir filter keamanan Gemini. Ubah deskripsi Anda.';
        res.status(500).json({ success: false, error: friendly, detail: m });
    }
});

// Error handler → selalu JSON (mencegah frontend gagal parse HTML error)
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') return res.status(413).json({ success: false, error: 'Data terlalu besar. Kurangi jumlah/ukuran gambar.' });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: 'Format request tidak valid.' });
    console.error(err);
    res.status(500).json({ success: false, error: 'Kesalahan server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    const p = config[config.active];
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║          🎬  DSTUDIO AI v4.1             ║');
    console.log('║     Studio Produksi Video AI             ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log(`🌐 Server   : http://localhost:${PORT}`);
    console.log(`🤖 Provider : ${p.name}`);
    console.log(`📦 Model    : ${p.model}`);
    console.log(`🔑 API Key  : ${process.env[p.apiKeyEnv] ? '✅ Terisi' : '❌ KOSONG'}\n`);
});
