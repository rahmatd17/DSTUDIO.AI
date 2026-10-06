// PROVIDER: Google Gemini (multimodal + retry + deadline)
const axios = require('axios');
const config = require('../config');

// Urutan: cepat dulu, model berat terakhir agar tidak melewati batas waktu klien (4 menit)
const FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-flash-latest'];
const DEADLINE_MS = 230000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function googleMsg(err) {
    return (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message;
}

async function callGemini(prompt, systemInstruction = '', references = [], signal = null) {
    const apiKey = process.env[config.gemini.apiKeyEnv];
    if (!apiKey || apiKey.includes('ISI_API_KEY') || apiKey.includes('GANTI')) {
        throw new Error('GEMINI_API_KEY belum diisi di file .env');
    }

    const parts = [{ text: prompt }];
    references.slice(0, 10).forEach((ref, i) => {
        parts.push({ text: `\n[REFERENSI ${i + 1} - ${String(ref.category).toUpperCase()}] ${ref.fileName}` });
        parts.push({ inline_data: { mime_type: ref.mimeType, data: ref.data } });
    });

    const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 32000,
            topP: 0.9,
            topK: 30,
            // Batasi "thinking" supaya jatah token tidak habis sebelum output selesai
            thinkingConfig: { thinkingBudget: 2048 }
        }
    };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

    const models = [config.gemini.model, ...FALLBACK_MODELS.filter(m => m !== config.gemini.model)];
    const started = Date.now();
    let lastError = null;
    let round = 0;
    const deadModels = new Set(); // 404 → model tak ada, jangan dicoba lagi

    // Ulangi daftar model dengan jeda makin panjang sampai deadline; 503/overloaded biasanya pulih sendiri.
    outer: while (true) {
        round++;
        const liveModels = models.filter(m => !deadModels.has(m));
        if (!liveModels.length) break;
        for (let mi = 0; mi < liveModels.length; mi++) {
            const modelName = liveModels[mi];
            if (signal && signal.aborted) throw new Error('dibatalkan');
            const remaining = DEADLINE_MS - (Date.now() - started);
            if (remaining < 15000) break outer;
            console.log(`🤖 [${modelName}] percobaan (putaran ${round})`);
            try {
                // API key lewat header, bukan URL, agar tidak bocor di log/error
                const res = await axios.post(`${config.gemini.endpoint}/${modelName}:generateContent`, body, {
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                    timeout: Math.min(remaining, 200000),
                    signal: signal || undefined
                });
                const data = res.data;
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error('Permintaan diblokir filter Gemini: ' + data.promptFeedback.blockReason);
                }
                const cand = data.candidates && data.candidates[0];
                const text = cand && cand.content && cand.content.parts
                    ? cand.content.parts.map(p => p.text).filter(Boolean).join('\n') : '';
                if (!text.trim()) throw new Error('Gemini mengembalikan hasil kosong (' + ((cand && cand.finishReason) || 'tanpa alasan') + ').');
                const truncated = cand.finishReason === 'MAX_TOKENS';
                if (truncated) console.warn('⚠️ Output terpotong (MAX_TOKENS). Kurangi jumlah adegan/shot.');
                console.log(`✅ Berhasil dengan ${modelName}`);
                return { text, truncated };
            } catch (err) {
                if ((signal && signal.aborted) || axios.isCancel(err)) throw new Error('dibatalkan');
                const status = err.response ? err.response.status : null;
                console.warn(`⚠️ [${modelName}] gagal — ${status || 'N/A'}: ${googleMsg(err)}`);
                lastError = err;
                if (status === 404) { deadModels.add(modelName); continue; }
                if (status === 400) {
                    // Self-heal: buang opsi yang ditolak model lalu ulangi model yang SAMA
                    // (perbaikan v4.0: versi lama memakai variabel `attempt` yang tidak ada → ReferenceError)
                    const gm = googleMsg(err);
                    const gc = body.generationConfig;
                    if (/thinking/i.test(gm) && gc.thinkingConfig) { delete gc.thinkingConfig; mi--; continue; }
                    if (/output.?tokens?/i.test(gm) && gc.maxOutputTokens > 8192) { gc.maxOutputTokens = 8192; mi--; continue; }
                    throw new Error(references.length ? 'Gemini menolak permintaan/gambar referensi: ' + gm : gm);
                }
                if (status === 401 || status === 403) throw new Error('403 ' + googleMsg(err));
                if (status === 429 || status === 500 || status === 503 || !status) {
                    const remaining2 = DEADLINE_MS - (Date.now() - started);
                    const wait = Math.min(3000 * Math.pow(1.7, round - 1) + Math.random() * 1000, 20000, Math.max(remaining2 - 15000, 0));
                    if (wait > 500) await sleep(wait);
                    continue;
                }
                throw err;
            }
        }
        const remaining3 = DEADLINE_MS - (Date.now() - started);
        if (remaining3 < 15000) break;
        await sleep(Math.min(2000 + round * 500, remaining3 - 15000));
    }
    const busy = lastError && /overloaded|high demand|UNAVAILABLE/i.test(googleMsg(lastError));
    throw new Error((busy ? 'sibuk: ' : '') + 'Semua model gagal setelah ' + round + ' putaran. Error terakhir: ' + (lastError ? googleMsg(lastError) : 'unknown'));
}

module.exports = { callGemini };
