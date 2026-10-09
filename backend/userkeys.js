// API KEY GEMINI PER PENGGUNA
// - Setiap akun menyimpan key miliknya sendiri, dienkripsi AES-256-GCM sebelum ditulis ke disk.
// - Disimpan di backend/data/userkeys.json (izin 600, diabaikan git). Tidak pernah dikirim utuh ke browser.
// - Hanya pemilik akun yang bisa memakai key tersebut; admin pun tidak bisa melihat key anggota lain.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, 'data');
const FILE = path.join(DIR, 'userkeys.json');
let encKey = null;
let DB = {};
try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (d && typeof d === 'object') DB = d; } catch (e) { /* belum ada */ }

// Dipanggil sekali dari server.js dengan secret sesi, agar kunci enkripsi ikut stabil antar restart
function init(secret) {
    encKey = crypto.createHash('sha256').update('dstudio-userkey|').update(secret).digest();
}
function persist() {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(DB, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, FILE);
    try { fs.chmodSync(FILE, 0o600); } catch (e) { /* Windows */ }
}
const valid = k => typeof k === 'string' && k.length >= 20 && k.length <= 400;
const mask = k => k.length <= 10 ? '••••' : k.slice(0, 4) + '••••••••' + k.slice(-4);

function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', encKey, iv);
    const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function decrypt(rec) {
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(rec.iv, 'base64'));
    d.setAuthTag(Buffer.from(rec.tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(rec.data, 'base64')), d.final()]).toString('utf8');
}

// Key plaintext hanya dipakai di server saat memanggil Gemini. Null jika belum ada / tidak bisa dibaca.
function get(userId) {
    const rec = DB[userId];
    if (!rec || !encKey) return null;
    try { return decrypt(rec); } catch (e) { return null; }
}
// Info aman untuk dikirim ke browser (tanpa key utuh)
function info(userId) {
    const rec = DB[userId];
    return { hasKey: !!rec, masked: rec ? rec.masked : '', updatedAt: rec ? rec.updatedAt : null };
}
function set(userId, key) {
    if (!valid(key) || !encKey) throw new Error('key tidak valid');
    DB[userId] = Object.assign(encrypt(key), { masked: mask(key), updatedAt: new Date().toISOString() });
    persist();
}
function remove(userId) {
    if (!DB[userId]) return;
    delete DB[userId];
    persist();
}

module.exports = { init, get, info, set, remove, mask };
