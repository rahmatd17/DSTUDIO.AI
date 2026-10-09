// AUTENTIKASI MULTI-PENGGUNA TANPA DATABASE
// - Akun disimpan di backend/data/users.json (password di-hash scrypt + salt unik, izin file 600)
// - Sesi: cookie HttpOnly bertanda tangan HMAC (tahan restart server). Ganti password / nonaktifkan akun = sesi lama langsung tidak berlaku.
// - Hanya admin yang bisa membuat, mereset, menonaktifkan, dan menghapus akun. Tidak ada pendaftaran bebas.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
// userkeys dihapus — API key sekarang global dari admin (DeepSeek)
const scrypt = promisify(crypto.scrypt);

const DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DIR, 'users.json');
const SECRET_FILE = path.join(DIR, 'secret.key');
const COOKIE = 'dstudio_sid';
const TTL = 30 * 24 * 3600 * 1000;
const MAX_USERS = 100;
const USER_RE = /^[A-Za-z0-9._-]{3,24}$/;

// ---------- penyimpanan ----------
let DB = { users: [] };
try { const d = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); if (Array.isArray(d.users)) DB = d; } catch (e) { /* belum ada */ }
function save() {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = USERS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(DB, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, USERS_FILE);
    try { fs.chmodSync(USERS_FILE, 0o600); } catch (e) { /* Windows */ }
}
const SECRET = (() => {
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) return Buffer.from(process.env.SESSION_SECRET);
    try { const b = fs.readFileSync(SECRET_FILE); if (b.length >= 32) return b; } catch (e) { /* buat baru */ }
    fs.mkdirSync(DIR, { recursive: true });
    const b = crypto.randomBytes(48);
    fs.writeFileSync(SECRET_FILE, b, { mode: 0o600 });
    return b;
})();

// ---------- password ----------
const hashPw = async (pw, salt) => (await scrypt(pw, salt, 64)).toString('hex');
const newSalt = () => crypto.randomBytes(16).toString('hex');
const ALPHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genPassword = (n = 10) => Array.from({ length: n }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
async function makeUser(username, password, role) {
    const salt = newSalt();
    return { id: crypto.randomBytes(6).toString('hex'), username, role, salt, hash: await hashPw(password, salt), disabled: false, createdAt: new Date().toISOString(), lastLogin: null };
}
const pub = u => ({ id: u.id, username: u.username, role: u.role, disabled: !!u.disabled, createdAt: u.createdAt, lastLogin: u.lastLogin });
const findName = n => DB.users.find(u => u.username.toLowerCase() === String(n).toLowerCase());
const activeAdmins = () => DB.users.filter(u => u.role === 'admin' && !u.disabled).length;
const pwError = p => (typeof p !== 'string' || p.length < 6) ? 'Password minimal 6 karakter.' : p.length > 100 ? 'Password terlalu panjang.' : '';

// ---------- sesi (cookie bertanda tangan) ----------
const sign = u => {
    const p = Buffer.from(JSON.stringify({ u: u.id, pv: u.hash.slice(0, 12), exp: Date.now() + TTL })).toString('base64url');
    return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
};
function verify(tok) {
    if (!tok || tok.indexOf('.') < 1) return null;
    const [p, s] = tok.split('.');
    const e = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
    const a = Buffer.from(s || ''), b = Buffer.from(e);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const d = JSON.parse(Buffer.from(p, 'base64url').toString());
        const u = DB.users.find(x => x.id === d.u);
        return (u && !u.disabled && d.exp > Date.now() && u.hash.slice(0, 12) === d.pv) ? u : null;
    } catch (e) { return null; }
}
const cookies = h => { const o = {}; String(h || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) { try { o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); } catch (e) { /* abaikan */ } } }); return o; };
const https = req => !!req.secure || req.headers['x-forwarded-proto'] === 'https';
const setSession = (req, res, user) => res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(sign(user))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL / 1000}` + (https(req) ? '; Secure' : ''));
const clearSession = (req, res) => res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` + (https(req) ? '; Secure' : ''));
const authUser = req => verify(cookies(req.headers.cookie)[COOKIE]);

// ---------- pembatas percobaan login ----------
const fails = new Map();
const lockLeft = k => { const f = fails.get(k); return f && f.lockUntil > Date.now() ? Math.ceil((f.lockUntil - Date.now()) / 1000) : 0; };
function noteFail(k, max) {
    const now = Date.now(); let f = fails.get(k);
    if (!f || now - f.first > 10 * 60e3) f = { n: 0, first: now, lockUntil: 0 };
    if (++f.n >= max) f.lockUntil = now + 10 * 60e3;
    fails.set(k, f);
}
setInterval(() => { const now = Date.now(); fails.forEach((f, k) => { if (now - f.first > 20 * 60e3) fails.delete(k); }); }, 5 * 60e3).unref();
const DUMMY_SALT = newSalt();

// ---------- middleware ----------
const PUBLIC = new Set(['/health', '/auth/me', '/auth/login', '/auth/setup', '/auth/logout']);
function gate(req, res, next) {
    if (PUBLIC.has(req.path)) return next();
    const u = authUser(req);
    if (!u) return res.status(401).json({ success: false, auth: true, error: 'Sesi berakhir atau belum login. Silakan login lagi.' });
    req.user = u; next();
}
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Hanya admin yang boleh melakukan ini.' });
    next();
}

// ---------- rute ----------
const A = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(e => { console.error('❌ auth:', e.message); res.status(500).json({ success: false, error: 'Terjadi kesalahan server.' }); });
function mount(app, { isLoopback }) {
    app.use('/api', gate);

    // Admin pertama dari .env (untuk server online): ADMIN_USER + ADMIN_PASSWORD
    if (!DB.users.length && USER_RE.test(process.env.ADMIN_USER || '') && !pwError(process.env.ADMIN_PASSWORD)) {
        const salt = newSalt();
        DB.users.push({ id: crypto.randomBytes(6).toString('hex'), username: process.env.ADMIN_USER, role: 'admin', salt, hash: crypto.scryptSync(process.env.ADMIN_PASSWORD, salt, 64).toString('hex'), disabled: false, createdAt: new Date().toISOString(), lastLogin: null });
        save(); console.log(`👤 Admin pertama "${process.env.ADMIN_USER}" dibuat dari .env`);
    }

    app.get('/api/auth/me', (req, res) => {
        const u = authUser(req), none = DB.users.length === 0, remote = !isLoopback(req);
        res.json({ success: true, authenticated: !!u, user: u ? pub(u) : null, needsSetup: none, remote, setupNeedsToken: none && remote && !!process.env.ADMIN_TOKEN, setupBlocked: none && remote && !process.env.ADMIN_TOKEN });
    });

    app.post('/api/auth/setup', A(async (req, res) => {
        if (DB.users.length) return res.status(403).json({ success: false, error: 'Akun admin sudah ada. Login dengan akun tersebut.' });
        const b = req.body || {}, name = String(b.username || '').trim(), pw = b.password;
        if (!isLoopback(req)) {
            const tok = process.env.ADMIN_TOKEN;
            if (!tok) return res.status(403).json({ success: false, error: 'Setup dari jarak jauh dinonaktifkan. Buka lewat http://localhost, atau isi ADMIN_USER dan ADMIN_PASSWORD (atau ADMIN_TOKEN) di .env.' });
            const given = Buffer.from(String(b.token || '')), want = Buffer.from(tok);
            if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return res.status(401).json({ success: false, error: 'Token admin salah.' });
        }
        if (!USER_RE.test(name)) return res.status(400).json({ success: false, error: 'Username 3–24 karakter: huruf, angka, titik, minus, underscore.' });
        const pe = pwError(pw); if (pe) return res.status(400).json({ success: false, error: pe });
        if (DB.users.length) return res.status(403).json({ success: false, error: 'Akun admin sudah ada.' });
        const u = await makeUser(name, pw, 'admin'); u.lastLogin = new Date().toISOString();
        DB.users.push(u); save(); setSession(req, res, u);
        console.log(`👤 Admin "${name}" dibuat lewat halaman setup`);
        res.json({ success: true, user: pub(u) });
    }));

    app.post('/api/auth/login', A(async (req, res) => {
        const b = req.body || {}, name = String(b.username || '').trim().slice(0, 40), pw = String(b.password || '').slice(0, 200);
        const kIp = 'ip|' + req.ip, kUser = 'u|' + name.toLowerCase();
        const wait = Math.max(lockLeft(kIp), lockLeft(kUser));
        if (wait) return res.status(429).json({ success: false, error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(wait / 60)} menit.` });
        if (!name || !pw) return res.status(400).json({ success: false, error: 'Isi username & password.' });
        const u = findName(name);
        const ok = u ? crypto.timingSafeEqual(Buffer.from(await hashPw(pw, u.salt)), Buffer.from(u.hash)) : (await hashPw(pw, DUMMY_SALT), false);
        if (!u || !ok) { noteFail(kIp, 12); noteFail(kUser, 6); console.warn(`🔐 Login gagal: ${USER_RE.test(name) ? name : '(nama tidak valid)'} dari ${req.ip}`); return res.status(401).json({ success: false, error: 'Username atau password salah.' }); }
        if (u.disabled) return res.status(403).json({ success: false, error: 'Akun ini dinonaktifkan. Hubungi admin.' });
        fails.delete(kIp); fails.delete(kUser);
        u.lastLogin = new Date().toISOString(); save(); setSession(req, res, u);
        res.json({ success: true, user: pub(u) });
    }));

    app.post('/api/auth/logout', (req, res) => { clearSession(req, res); res.json({ success: true }); });

    app.post('/api/auth/password', A(async (req, res) => {
        const b = req.body || {}, u = req.user, pe = pwError(b.newPassword);
        if (pe) return res.status(400).json({ success: false, error: pe });
        if (crypto.timingSafeEqual(Buffer.from(await hashPw(String(b.oldPassword || ''), u.salt)), Buffer.from(u.hash)) === false) return res.status(401).json({ success: false, error: 'Password lama salah.' });
        u.salt = newSalt(); u.hash = await hashPw(b.newPassword, u.salt); save(); setSession(req, res, u);
        res.json({ success: true });
    }));

    // --- kelola pengguna (admin) ---
    app.get('/api/users', requireAdmin, (req, res) => res.json({ success: true, users: DB.users.map(pub), me: req.user.id }));

    app.post('/api/users', requireAdmin, A(async (req, res) => {
        const b = req.body || {}, name = String(b.username || '').trim(), role = b.role === 'admin' ? 'admin' : 'user';
        if (!USER_RE.test(name)) return res.status(400).json({ success: false, error: 'Username 3–24 karakter: huruf, angka, titik, minus, underscore.' });
        if (findName(name)) return res.status(409).json({ success: false, error: 'Username sudah dipakai.' });
        if (DB.users.length >= MAX_USERS) return res.status(400).json({ success: false, error: `Maksimal ${MAX_USERS} akun.` });
        const generated = !b.password, pw = generated ? genPassword() : b.password, pe = pwError(pw);
        if (pe) return res.status(400).json({ success: false, error: pe });
        const u = await makeUser(name, pw, role); DB.users.push(u); save();
        console.log(`👤 Akun "${name}" (${role}) dibuat oleh ${req.user.username}`);
        res.json({ success: true, user: pub(u), password: pw });
    }));

    app.patch('/api/users/:id', requireAdmin, A(async (req, res) => {
        const u = DB.users.find(x => x.id === req.params.id), b = req.body || {};
        if (!u) return res.status(404).json({ success: false, error: 'Akun tidak ditemukan.' });
        const self = u.id === req.user.id; let password;
        if (typeof b.disabled === 'boolean') {
            if (self && b.disabled) return res.status(400).json({ success: false, error: 'Anda tidak bisa menonaktifkan akun sendiri.' });
            if (b.disabled && u.role === 'admin' && activeAdmins() <= 1) return res.status(400).json({ success: false, error: 'Harus ada minimal satu admin aktif.' });
            u.disabled = b.disabled;
        }
        if (b.role === 'admin' || b.role === 'user') {
            if (u.role === 'admin' && b.role === 'user' && activeAdmins() <= 1) return res.status(400).json({ success: false, error: 'Harus ada minimal satu admin aktif.' });
            u.role = b.role;
        }
        if (b.resetPassword || b.password) {
            password = b.password || genPassword(); const pe = pwError(password);
            if (pe) return res.status(400).json({ success: false, error: pe });
            u.salt = newSalt(); u.hash = await hashPw(password, u.salt);
        }
        save(); if (self && password) setSession(req, res, u);
        res.json({ success: true, user: pub(u), password });
    }));

    app.delete('/api/users/:id', requireAdmin, (req, res) => {
        const u = DB.users.find(x => x.id === req.params.id);
        if (!u) return res.status(404).json({ success: false, error: 'Akun tidak ditemukan.' });
        if (u.id === req.user.id) return res.status(400).json({ success: false, error: 'Anda tidak bisa menghapus akun sendiri.' });
        if (u.role === 'admin' && !u.disabled && activeAdmins() <= 1) return res.status(400).json({ success: false, error: 'Harus ada minimal satu admin aktif.' });
        DB.users = DB.users.filter(x => x.id !== u.id); save();
        console.log(`👤 Akun "${u.username}" dihapus oleh ${req.user.username}`);
        res.json({ success: true });
    });
}

module.exports = { mount, requireAdmin, gate, SECRET };
