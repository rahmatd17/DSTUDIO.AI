// PROVIDER: DeepSeek (OpenAI-compatible chat completions)
// API key tunggal dari admin (.env DEEPSEEK_API_KEY), bukan per pengguna.
const axios = require('axios');
const config = require('../config');

const DEADLINE_MS = 180000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function apiKey() {
    const k = (process.env.DEEPSEEK_API_KEY || '').trim();
    return k.length >= 10 ? k : null;
}

function friendlyDeepseek(err) {
    const status = err.response ? err.response.status : null;
    const msg = (err.response && err.response.data && (err.response.data.error && err.response.data.error.message || err.response.data.message)) || err.message || '';
    if (status === 401 || /invalid.?api.?key|authentication|unauthorized/i.test(msg)) return 'API key DeepSeek tidak valid. Admin: perbarui DEEPSEEK_API_KEY di .env atau lewat menu Pengaturan.';
    if (status === 402 || /insufficient|balance|quota|billing/i.test(msg)) return 'Kuota / saldo DeepSeek habis. Admin: isi ulang di platform.deepseek.com.';
    if (status === 429 || /rate.?limit/i.test(msg)) return 'Rate limit DeepSeek. Tunggu sebentar lalu coba lagi.';
    if (status === 503 || /overloaded|capacity/i.test(msg)) return 'Server DeepSeek sedang sibuk. Coba lagi dalam 1-2 menit.';
    if (err.code === 'ECONNABORTED' || /timeout/i.test(msg)) return 'Server AI terlalu lama merespon.';
    if (/dibatalkan|aborted/i.test(msg)) return msg;
    return msg || 'Gagal memanggil DeepSeek.';
}

/**
 * Panggil DeepSeek chat completions.
 * @param {string} prompt - user message
 * @param {string} systemInstruction
 * @param {AbortSignal|null} signal
 * @param {object} genOpts - temperature, max_tokens
 */
async function callDeepseek(prompt, systemInstruction = '', signal = null, genOpts = {}) {
    const key = apiKey();
    if (!key) throw new Error('NO_ADMIN_KEY');

    const model = config.deepseek.model || 'deepseek-chat';
    const body = {
        model,
        messages: [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            { role: 'user', content: prompt }
        ],
        temperature: genOpts.temperature != null ? genOpts.temperature : 0.7,
        max_tokens: genOpts.max_tokens || genOpts.maxOutputTokens || 8192,
        stream: false
    };

    const started = Date.now();
    let lastError = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (signal && signal.aborted) throw new Error('dibatalkan');
        const remaining = DEADLINE_MS - (Date.now() - started);
        if (remaining < 10000) break;

        try {
            console.log(`🤖 [deepseek/${model}] percobaan ${attempt}`);
            const res = await axios.post(
                `${config.deepseek.endpoint}/chat/completions`,
                body,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${key}`
                    },
                    timeout: Math.min(remaining, 160000),
                    signal: signal || undefined
                }
            );
            const choice = res.data && res.data.choices && res.data.choices[0];
            const text = (choice && choice.message && choice.message.content) || '';
            const finish = choice && choice.finish_reason;
            if (!text.trim()) throw new Error('DeepSeek mengembalikan jawaban kosong.');
            return { text: text.trim(), truncated: finish === 'length', model, usage: res.data.usage || null };
        } catch (err) {
            if (signal && signal.aborted) throw new Error('dibatalkan');
            lastError = err;
            const status = err.response ? err.response.status : null;
            // Jangan retry auth / balance
            if (status === 401 || status === 402 || status === 400) break;
            if (attempt < maxAttempts && (status === 429 || status === 503 || status >= 500 || err.code === 'ECONNABORTED')) {
                const wait = status === 429 ? 4000 * attempt : 2000 * attempt;
                console.warn(`⚠️ DeepSeek ${status || err.code}: tunggu ${wait}ms lalu coba lagi`);
                await sleep(wait);
                continue;
            }
            break;
        }
    }
    throw new Error(friendlyDeepseek(lastError || new Error('Gagal memanggil DeepSeek')));
}

async function testKey(key) {
    const k = String(key || '').trim();
    if (k.length < 10) return { ok: false, status: 0, message: 'Key terlalu pendek' };
    try {
        const res = await axios.post(
            `${config.deepseek.endpoint}/chat/completions`,
            {
                model: config.deepseek.model || 'deepseek-chat',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
            },
            {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
                timeout: 20000
            }
        );
        return { ok: !!(res.data && res.data.choices), status: 200, message: 'ok' };
    } catch (err) {
        const status = err.response ? err.response.status : 0;
        const message = (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message;
        return { ok: false, status, message };
    }
}

function keyReady() {
    return !!apiKey();
}

function maskedKey() {
    const k = apiKey();
    if (!k) return '';
    return k.length <= 10 ? '••••' : k.slice(0, 4) + '••••••••' + k.slice(-4);
}

module.exports = { callDeepseek, testKey, keyReady, maskedKey, apiKey, friendlyDeepseek };
