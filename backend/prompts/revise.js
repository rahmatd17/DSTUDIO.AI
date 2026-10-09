const { GLOBAL_RULES } = require('./master-rules');
// PROMPT REVISI — regenerasi satu adegan atau revisi seluruh hasil dengan instruksi singkat.
const B = require('./builder');

function context(o) {
    const lock = B.assetBlock(o) + B.brandBlock(o) + B.variantBlock(o) + B.extrasBlock(o);
    const set = [
        o.durasi && `Durasi per adegan: ${o.durasi}`, o.shot && `Shot per adegan: ${o.shot}`, o.ratio && `Rasio: ${o.ratio}`,
        o.voice && `Voice mode: ${o.voice}`, o.lang && `Bahasa konten: ${o.lang}`, o.style && `Style visual: ${o.style}`
    ].filter(Boolean).join(' | ');
    return (o.lockText ? `═══ KONTEKS TETAP DARI PART 1 / MASTER SCENE (JANGAN DIUBAH) ═══\n${o.lockText}\n\n` : '') + lock + (set ? `SETTING: ${set}\n\n` : '');
}

const COMMON = `ATURAN MUTLAK:
- Pertahankan Master Scene, lokasi, karakter (nama, wajah, outfit), produk, brand, bahasa, dan gaya visual persis seperti aslinya.
- Format output IDENTIK dengan teks asli: label [IMAGE PROMPT] dan [VIDEO PROMPT], penomoran panel/shot, struktur timing, blok NEGATIVE, dan gaya penulisan.
- Tanpa kalimat pembuka, penutup, penjelasan, atau tanda kutip kode. Langsung keluarkan hasilnya.`;

function buildReviseSystem(o) {
    // BUG FIX: sebelumnya aturan format dialog (CHARACTER REGISTRY, VOICE MAPPING,
    // format [timestamp] [CHAR_ID] Nama: "dialog", validasi) tidak pernah disertakan saat
    // merevisi — AI tidak tahu aturan ketat ini sehingga hasil revisi dialog bisa salah format
    // (CHAR_ID hilang, karakter tertukar, timestamp tidak konsisten dengan adegan asli).
    // Selalu sertakan aturan dialog agar revisi (termasuk "Generate ulang dari dialog") tetap patuh.
    // BUG FIX #2: aturan sinkron PANEL (gambar) ⇄ SHOT (video) juga tidak pernah disertakan saat
    // merevisi/generate ulang adegan — AI jadi bebas "mengarang" aksi/objek baru di [VIDEO PROMPT]
    // yang tidak ada di [IMAGE PROMPT] adegan yang sama. Selalu sertakan agar revisi & "Buat ulang
    // adegan" / "Generate ulang dari dialog" tetap mengikuti isi panel gambar, bukan berimajinasi.
    return GLOBAL_RULES.kesetiaanArahan + '\n\n' + buildReviseSystemInner(o) + '\n\n' + GLOBAL_RULES.videoImageSyncRule + '\n\n' + GLOBAL_RULES.aturanDialog;
}

function buildReviseSystemInner(o) {
    if (o.scope === 'adegan') {
        return context(o) + `Kamu adalah editor storyboard video AI. TUGAS: tulis ulang HANYA ADEGAN ${o.adeganNo} saja.\n` +
            (o.instruction
                ? `INSTRUKSI REVISI USER: "${o.instruction}"\nTerapkan instruksi ini pada adegan. Ubah HANYA bagian yang disebut; bagian lain salin sama persis dari adegan asli.\n`
                : `Tidak ada instruksi revisi: tulis ulang adegan ini dengan isi yang SAMA seperti aslinya. Jangan menambah detail, aksi, atau variasi baru.\n`) +
            COMMON + `\n- Output WAJIB diawali baris judul: ### ADEGAN ${o.adeganNo} — [judul adegan], lalu [IMAGE PROMPT] dan [VIDEO PROMPT].\n- Jika instruksi memuat dialog: salin dialog itu PERSIS ke TIMELINE DIALOG di dalam [VIDEO PROMPT], sesuaikan timestamp/shot/SFX agar cocok, jangan mengubah [IMAGE PROMPT] kecuali diminta.\n- Jangan menulis adegan lain dan jangan menulis blok pembatas ═══.\n- Teks yang akan direvisi ada di pesan user di bawah label ADEGAN ASLI.`;
    }
    return context(o) + `Kamu adalah editor storyboard video AI. TUGAS: terapkan instruksi revisi pada SELURUH hasil di bawah ini.\n` +
        `INSTRUKSI REVISI USER: "${o.instruction}"\nUbah SEMINIMAL MUNGKIN: hanya bagian yang relevan dengan instruksi (termasuk semua tempat yang terdampak, mis. CTA di adegan terakhir dan di caption). Seluruh bagian lain HARUS identik karakter demi karakter.\n` +
        COMMON + `\n- Keluarkan dokumen LENGKAP dari awal sampai akhir (termasuk ### MASTER SCENE, semua ### ADEGAN, dan blok ═══ di akhir), bukan hanya bagian yang berubah.`;
}

function buildReviseUser(o) {
    return o.scope === 'adegan'
        ? `ADEGAN ASLI:\n${o.currentText}\n\n${o.instruction ? 'Terapkan instruksi revisi.' : 'Buat ulang adegan ini.'}`
        : `HASIL ASLI:\n${o.currentText}\n\nTerapkan instruksi revisi pada seluruh hasil.`;
}

module.exports = { buildReviseSystem, buildReviseUser };