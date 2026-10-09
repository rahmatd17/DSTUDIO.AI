require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const deepseek = require('./providers/deepseek');
const auth = require('./auth');
const VARIANTS = require('./prompts/variants');
const revise = require('./prompts/revise');
const { clip, findVariant } = require('./prompts/builder');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));

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

const isLoopback = req => /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '') && !req.headers['x-forwarded-for'];
auth.mount(app, { isLoopback });

// Hanya index.html yang disajikan
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

// Rate limit sederhana per IP / user
const hits = new Map();
function rateLimit(max, windowMs) {
    return (req, res, next) => {
        const now = Date.now();
        const key = req.user ? 'u:' + req.user.id : req.ip;
        const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
        if (arr.length >= max) {
            return res.status(429).json({ success: false, error: 'Terlalu banyak permintaan. Tunggu sebentar.' });
        }
        arr.push(now); hits.set(key, arr); next();
    };
}
setInterval(() => hits.clear(), 10 * 60 * 1000).unref();

app.get('/api/health', (req, res) => {
    const p = config[config.active];
    res.json({
        status: 'ok',
        provider: config.active,
        providerName: p.name,
        model: p.model,
        keyReady: deepseek.keyReady(),
        timestamp: new Date().toISOString()
    });
});

// Brand Kit & Product Lock dari klien
const cleanBrand = b => (b && typeof b === 'object' && clip(b.name, 60)) ? { name: clip(b.name, 60), slogan: clip(b.slogan, 120), colors: clip(b.colors, 160), font: clip(b.font, 80), tone: clip(b.tone, 200), usp: clip(b.usp, 300), forbidden: clip(b.forbidden, 300), logo: clip(b.logo, 300), notes: clip(b.notes, 300) } : null;
const cleanProduct = p => (p && typeof p === 'object' && clip(p.name, 80)) ? { name: clip(p.name, 80), desc: clip(p.desc, 700), label: clip(p.label, 200), size: clip(p.size, 100), must: clip(p.must, 200) } : null;
const cleanLocks = b => ({
    lockChars: (Array.isArray(b.lockChars) ? b.lockChars : []).filter(c => c && typeof c === 'object').slice(0, 4).map(c => ({ name: clip(c.name, 40), text: clip(c.text, 1500) })),
    lockLoc: b.lockLoc && b.lockLoc.text ? { name: clip(b.lockLoc.name, 40), text: clip(b.lockLoc.text, 1500) } : null
});

function friendlyError(m, def = 'Gagal memproses permintaan.') {
    m = m || '';
    if (m.includes('NO_ADMIN_KEY')) return 'API key DeepSeek belum dikonfigurasi. Hubungi admin untuk mengisi DEEPSEEK_API_KEY.';
    if (/rate.?limit|429/i.test(m)) return 'Rate limit DeepSeek. Tunggu sebentar lalu coba lagi.';
    if (/kuota|balance|402|insufficient/i.test(m)) return 'Kuota / saldo DeepSeek habis. Admin perlu isi ulang di platform.deepseek.com.';
    if (/invalid.?api.?key|401|unauthorized/i.test(m)) return 'API key DeepSeek tidak valid. Admin: perbarui di menu Pengaturan atau file .env.';
    if (/timeout/i.test(m)) return 'Server AI terlalu lama merespon.';
    if (/diblokir|safety|prohibited/i.test(m)) return 'Permintaan ditolak filter keamanan. Ubah deskripsi Anda.';
    return m.length < 200 ? m : def;
}

const NEED_KEY_MSG = 'API key DeepSeek belum dikonfigurasi di server. Hubungi admin.';
const needKey = res => res.status(503).json({ success: false, needKey: true, error: NEED_KEY_MSG });

const clamp = (v, min, max, def) => Math.min(Math.max(Number(v) || def, min), max);
const cleanObj = (o, maxKeys, maxLen) => Object.fromEntries(Object.entries(o && typeof o === 'object' && !Array.isArray(o) ? o : {}).slice(0, maxKeys).map(([k, v]) => [String(k).slice(0, 40), String(v == null ? '' : v).slice(0, maxLen)]));

// Daftar jenis konten per menu
app.get('/api/variants', (req, res) => {
    const out = {};
    for (const [cat, list] of Object.entries(VARIANTS)) out[cat] = list.map(({ id, name, desc, def, ex, ph }) => ({ id, name, desc, def, ex, ph }));
    res.json({ success: true, variants: out });
});

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
    if (!deepseek.keyReady()) return needKey(res);

    const adegan = clamp(b.adegan, 1, 10, 2);
    const shotPerAdegan = clamp(b.shotPerAdegan, 1, 6, 5);
    const started = Date.now();
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });

    try {
        const systemPrompt = config.buildSystemPrompt({
            ...b, category, adegan, shotPerAdegan,
            totalPart: clamp(b.totalPart, 1, 6, 1),
            part: clamp(b.part, 1, 6, 1),
            lock: String(b.lock || '').slice(0, 4000),
            prevTail: String(b.prevTail || '').slice(-1800),
            ...cleanLocks(b),
            variantId: clip(b.variantId, 40), brand: cleanBrand(b.brand), product: cleanProduct(b.product),
            extras: cleanObj(b.extras, 14, 200),
            charDetails: b.charDetails ? cleanObj(b.charDetails, 16, 200) : null,
            locDetails: b.locDetails ? cleanObj(b.locDetails, 16, 200) : null,
            charCount: clamp(b.charCount, 1, 6, 3),
            hookCount: clamp(b.hookCount, 1, 15, 5),
            titleCount: clamp(b.titleCount, 1, 20, 10),
            hasReferences: false, referenceCount: 0
        });

        const out = await deepseek.callDeepseek(prompt.trim(), systemPrompt, ac.signal);
        const result = config.postProcess(out.text, category);
        const duration = ((Date.now() - started) / 1000).toFixed(2);

        const hasImage = /\[IMAGE PROMPT\]/i.test(result);
        const hasVideo = /\[VIDEO PROMPT\]/i.test(result);
        const hasMaster = /###\s*MASTER SCENE/i.test(result);
        const hasNegVideo = /NEGATIVE VIDEO/i.test(result);
        console.log(`✅ [${category}] ${mode} · ${duration}s · ${result.length} char · master:${hasMaster ? 'ya' : 'TIDAK'} · negVideo:${hasNegVideo ? 'ya' : 'TIDAK'}`);
        if (mode === 'multi' && category !== 'konten-sosmed' && (!hasImage || !hasVideo)) {
            console.warn(`⚠️ Output multi tidak lengkap (image:${hasImage} video:${hasVideo})`);
        }

        res.json({
            success: true, mode: mode || 'multi',
            provider: config.active, providerName: config[config.active].name,
            meta: { category, categoryName, part: clamp(b.part, 1, 6, 1), totalPart: clamp(b.totalPart, 1, 6, 1), adegan, shotPerAdegan, durasi, aspectRatio, language, referenceCount: 0 },
            duration: duration + 's', result, truncated: !!out.truncated, timestamp: new Date().toISOString()
        });
    } catch (err) {
        if (ac.signal.aborted) { console.log('⏹️ Dibatalkan: klien menutup koneksi'); return; }
        console.error('❌ Error:', err.message);
        res.status(500).json({ success: false, error: friendlyError(err.message), detail: err.message });
    }
});

// ===== Settings API (status provider + API key admin-only) =====
function settingsState() {
    const p = config[config.active];
    return {
        keyReady: deepseek.keyReady(),
        masked: deepseek.maskedKey(),
        provider: config.active,
        providerName: p.name,
        model: p.model,
        source: 'admin'
    };
}

app.get('/api/settings', (req, res) => {
    res.json({ success: true, ...settingsState() });
});

// Hanya admin yang boleh mengubah API key (disimpan ke .env runtime + file .env jika ada)
app.post('/api/settings/key', rateLimit(6, 60 * 1000), async (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Hanya admin yang boleh mengatur API key DeepSeek.' });
    }
    const key = String((req.body || {}).key || '').replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/\s+/g, '');
    if (!/^sk-[A-Za-z0-9_-]{10,200}$/.test(key) && !/^[A-Za-z0-9_-]{20,400}$/.test(key)) {
        return res.status(400).json({ success: false, error: 'Format key tidak valid. Tempel key DeepSeek lengkap (biasanya diawali sk-).' });
    }
    const t = await deepseek.testKey(key);
    if (!t.ok) {
        return res.status(400).json({
            success: false,
            error: 'DeepSeek menolak key ini: ' + (t.message || ('HTTP ' + t.status))
        });
    }
    // Set di process.env agar langsung dipakai tanpa restart
    process.env.DEEPSEEK_API_KEY = key;
    // Coba tulis ke file .env (best-effort)
    try {
        const envPath = path.join(__dirname, '..', '.env');
        let content = '';
        try { content = fs.readFileSync(envPath, 'utf8'); } catch (e) { /* baru */ }
        if (/^DEEPSEEK_API_KEY=/m.test(content)) {
            content = content.replace(/^DEEPSEEK_API_KEY=.*$/m, 'DEEPSEEK_API_KEY=' + key);
        } else {
            content = (content ? content.replace(/\s*$/, '\n') : '') + 'DEEPSEEK_API_KEY=' + key + '\n';
        }
        fs.writeFileSync(envPath, content, { mode: 0o600 });
    } catch (e) {
        console.warn('⚠️ Tidak bisa menulis .env:', e.message);
    }
    console.log(`🔑 Admin ${req.user.username} memperbarui DEEPSEEK_API_KEY (${deepseek.maskedKey()})`);
    res.json({ success: true, verified: true, warning: '', ...settingsState() });
});

app.delete('/api/settings/key', rateLimit(6, 60 * 1000), (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Hanya admin yang boleh menghapus API key.' });
    }
    delete process.env.DEEPSEEK_API_KEY;
    try {
        const envPath = path.join(__dirname, '..', '.env');
        let content = fs.readFileSync(envPath, 'utf8');
        content = content.replace(/^DEEPSEEK_API_KEY=.*$/m, 'DEEPSEEK_API_KEY=');
        fs.writeFileSync(envPath, content, { mode: 0o600 });
    } catch (e) { /* ignore */ }
    console.log(`🔑 Admin ${req.user.username} menghapus DEEPSEEK_API_KEY`);
    res.json({ success: true, ...settingsState() });
});

// ===== Revisi =====
app.post('/api/revise', rateLimit(20, 60 * 1000), async (req, res) => {
    const b = req.body || {};
    const scope = b.scope === 'all' ? 'all' : 'adegan';
    const currentText = String(b.currentText || '');
    const instruction = clip(b.instruction, 600);
    if (!config.CATEGORIES.includes(b.category)) return res.status(400).json({ success: false, error: 'Kategori tidak dikenal.' });
    if (currentText.trim().length < 20 || currentText.length > 60000) return res.status(400).json({ success: false, error: 'Teks yang direvisi tidak valid.' });
    if (scope === 'all' && instruction.length < 3) return res.status(400).json({ success: false, error: 'Tulis instruksi revisi minimal 3 karakter.' });
    if (!deepseek.keyReady()) return needKey(res);
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    const started = Date.now();
    try {
        const o = {
            scope, instruction, currentText, adeganNo: clamp(b.adeganNo, 1, 20, 1),
            category: b.category, variant: findVariant(b.category, clip(b.variantId, 40)),
            brand: cleanBrand(b.brand), product: cleanProduct(b.product), ...cleanLocks(b),
            extras: cleanObj(b.extras, 14, 200), lockText: String(b.lockText || '').slice(0, 4000),
            durasi: clip(b.durasi, 10), shot: clamp(b.shotPerAdegan, 1, 6, 4), ratio: clip(b.aspectRatio, 8),
            voice: clip(b.voiceMode, 60), lang: clip(b.language, 40), style: clip(b.style, 120)
        };
        const out = await deepseek.callDeepseek(revise.buildReviseUser(o), revise.buildReviseSystem(o), ac.signal);
        let text = (out.text || '').trim();
        if (/^[═\-]{8,}/m.test(text)) {
            text = text.replace(/\n[ \t]*═{8,}[\s\S]*$/, '').trim();
        }
        res.json({ success: true, scope, result: text, truncated: !!out.truncated, duration: ((Date.now() - started) / 1000).toFixed(1) + 's' });
    } catch (err) {
        if (ac.signal.aborted) return;
        console.error('❌ Revisi gagal:', err.message);
        res.status(500).json({ success: false, error: friendlyError(err.message), detail: err.message });
    }
});

// ===== Bantu lengkapi ide cerita =====
const ENRICH_SYSTEM = `Anda MELENGKAPI ide video pendek milik pengguna. Anda BUKAN penulis ide bebas dan DILARANG mengganti ide pengguna dengan ide lain.

ATURAN MUTLAK (prioritas tertinggi):
1. SUBJEK UTAMA (siapa/apa) dan AKSI UTAMA (melakukan apa) dari ide pengguna WAJIB tetap ada persis di hasil akhir. Dilarang mengganti subjek atau aksinya dengan yang lain, dilarang mengarang ide baru yang tidak diminta.
2. Jika ide pengguna sudah menyebut detail tertentu (nama, warna, tempat, dsb), salin detail itu apa adanya. Jangan diganti versi lain.
3. Anda HANYA boleh menambah detail PENDUKUNG di sekitar ide yang sudah ada: penampilan fisik, lokasi & suasana, gerakan tambahan yang MENDUKUNG (bukan menggantikan) aksi utama, gaya visual & pencahayaan, sudut kamera, musik/suara latar.
4. Jangan mengubah mood/genre ide (lucu tetap lucu, serius tetap serius) kecuali pengguna jelas memintanya.
5. Jangan menambahkan teks, logo, atau merek yang tidak diminta. Jangan memakai nama tokoh publik nyata.

FORMAT KELUARAN:
- Jawab HANYA dengan teks brief dalam Bahasa Indonesia, satu paragraf, 3 sampai 6 kalimat (sekitar 60-120 kata).
- Tanpa judul, tanpa markdown, tanpa bullet, tanpa tanda kutip di awal/akhir, tanpa basa-basi.

Jika ide pengguna sudah cukup lengkap, boleh tetap menambah sedikit detail sinematik tanpa mengubah intinya sama sekali.`;

const ENRICH_STOPWORDS = new Set(['yang', 'dengan', 'untuk', 'dari', 'akan', 'pada', 'ini', 'itu', 'dan', 'atau', 'saya', 'kita', 'kami', 'buatkan', 'buat', 'bikin', 'tolong', 'mohon', 'please', 'video', 'gambar', 'sebuah', 'seorang', 'para', 'juga', 'agar', 'supaya', 'dalam', 'adalah', 'sebagai', 'lagi', 'saat', 'ketika', 'oleh', 'punya']);
function enrichKeywords(idea) {
    return [...new Set(idea.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 4 && !ENRICH_STOPWORDS.has(w)))];
}

app.post('/api/enrich', rateLimit(15, 60 * 1000), async (req, res) => {
    const b = req.body || {};
    // Client mengirim "idea"; terima juga "prompt" agar kompatibel
    const idea = String(b.idea || b.prompt || '').trim();
    if (idea.length < 3) return res.status(400).json({ success: false, error: 'Ide terlalu pendek. Tulis minimal 3 karakter.' });
    if (idea.length > 1500) return res.status(400).json({ success: false, error: 'Ide terlalu panjang.' });
    if (!deepseek.keyReady()) return needKey(res);
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    const cat = String(b.category || '').trim();
    const catName = String(b.categoryName || cat || 'video').trim();
    const menuHint = cat
        ? `\nMenu/kategori aktif: "${catName}" (id: ${cat}). Sesuaikan detail pendukung dengan jenis konten menu ini (tanpa mengubah subjek/aksi utama).`
        : '';
    try {
        const out = await deepseek.callDeepseek(
            'Lengkapi ide video berikut (jangan ganti subjek/aksi utama):\n\n' + idea + menuHint,
            ENRICH_SYSTEM,
            ac.signal,
            { temperature: 0.6, max_tokens: 400 }
        );
        let text = (out.text || '').trim().replace(/^["'«»]|["'«»]$/g, '').trim();
        // Cek apakah masih membahas ide asli
        const kws = enrichKeywords(idea);
        const lower = text.toLowerCase();
        const hit = kws.filter(k => lower.includes(k)).length;
        if (kws.length >= 2 && hit < Math.min(2, Math.ceil(kws.length * 0.3))) {
            return res.json({ success: true, text: idea, note: 'AI menyimpang; ide asli dikembalikan.' });
        }
        res.json({ success: true, text });
    } catch (err) {
        if (ac.signal.aborted) return;
        res.status(500).json({ success: false, error: friendlyError(err.message) });
    }
});

// Error handler → selalu JSON
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') return res.status(413).json({ success: false, error: 'Data terlalu besar.' });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: 'Format request tidak valid.' });
    console.error(err);
    res.status(500).json({ success: false, error: 'Kesalahan server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    const p = config[config.active];
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║          🎬  DSTUDIO AI v5.1             ║');
    console.log('║     Studio Produksi Video AI             ║');
    console.log('╚══════════════════════════════════════════╝\n');
    console.log(`🌐 Server   : http://localhost:${PORT}`);
    console.log(`🤖 Provider : ${p.name}`);
    console.log(`📦 Model    : ${p.model}`);
    console.log(`🔑 API Key  : ${deepseek.keyReady() ? 'siap (admin) · ' + deepseek.maskedKey() : 'BELUM DIISI — set DEEPSEEK_API_KEY di .env'}\n`);
});
