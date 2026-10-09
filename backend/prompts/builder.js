// ============================================
// PROMPT BUILDER v4.0 — Multi & Single Mode
// 7 Menu Produksi + Tools + Scene Lock + Video Berurutan
// ============================================

const rules = require('./master-rules');
const VARIANTS = require('./variants');

// Blok bantu: pembagian waktu & kombinasi shot (memakai master-rules yang sebelumnya tidak terpakai)
function timingBlock(o) {
    return `DURASI PER ADEGAN: ${o.durasi} (${o.perShot}s per shot × ${o.shot} shot)
KOMBINASI SHOT IDEAL: ${o.combo}
KAMUS SHOT: WD = ${rules.KAMUS_SHOT.WD} | MD = ${rules.KAMUS_SHOT.MD} | CU = ${rules.KAMUS_SHOT.CU}
⚠️ Semua timestamp di [VIDEO PROMPT] WAJIB dibagi rata sesuai ${o.perShot}s per shot dan berakhir tepat di ${o.durasi}.

${rules.GLOBAL_RULES.aturanGlobal}

${rules.GLOBAL_RULES.videoSequentialRule}
NEGATIVE VIDEO (salin ke baris terakhir tiap [VIDEO PROMPT]): ${rules.GLOBAL_RULES.negativeVideo}`;
}


// ---------- PRODUKSI BERTAHAP, ASET TERKUNCI, OPSI TAMBAHAN ----------
function partBlock(o, category) {
    if (o.totalPart <= 1) return '';
    const role = o.part === 1 ? 'PEMBUKA (perkenalan karakter + latar + hook kuat)'
        : o.part === o.totalPart ? 'KLIMAKS & PENUTUP (resolusi + CTA)'
        : `PENGEMBANGAN CERITA bagian ke-${o.part}, sambung langsung dari part sebelumnya`;
    let t = `═══ PRODUKSI BERTAHAP: PART ${o.part} DARI ${o.totalPart} ═══
Ide user adalah SATU cerita besar yang dibagi ${o.totalPart} part. Tulis HANYA PART ${o.part}: ${role}.
Nomor adegan di part ini tetap mulai dari 1. Jangan menulis part lain.`;
    if (category === 'konten-sosmed') t += `\nKhusus format konten: ${o.part > 1 ? 'LEWATI bagian [A] HOOK dan [B] JUDUL. ' : ''}${o.part < o.totalPart ? 'LEWATI bagian [E] DISTRIBUSI dan [F] (hanya part terakhir yang menulisnya).' : 'Tulis [E] DISTRIBUSI & [F] untuk seluruh seri.'}`;
    if (o.part > 1 && o.lock) t += `\n\nDATA TERKUNCI DARI PART 1 — SALIN PERSIS, DILARANG DIUBAH:\n${o.lock}\n→ Tulis ulang "### MASTER SCENE" IDENTIK dengan data di atas. Wajah, rambut, outfit, aksesoris, voice, dan ID karakter WAJIB sama.`;
    if (o.part > 1 && o.prevTail) t += `\n\nCUPLIKAN AKHIR PART SEBELUMNYA (lanjutkan dari sini, jangan diulang):\n${o.prevTail}`;
    return t + '\n\n';
}

function assetBlock(o) {
    let t = '';
    if (o.lockChars && o.lockChars.length) {
        t += '═══ KARAKTER TERKUNCI (WAJIB) ═══\n' + o.lockChars.map((c, i) => `[CHAR_${i + 1}] ${c.name}: ${c.text}`).join('\n') +
            '\nSetiap kemunculan karakter di [IMAGE PROMPT] dan [VIDEO PROMPT] WAJIB menyalin deskripsi fisik + outfit di atas APA ADANYA (wajah, rambut, kulit, pakaian, aksesoris). Masukkan ke CHARACTER REGISTRY dengan ID yang sama. Dilarang menambah karakter baru melebihi batas.\n\n';
    }
    if (o.lockLoc) t += `═══ LATAR TERKUNCI (WAJIB) ═══\n${o.lockLoc.name}: ${o.lockLoc.text}\n"### MASTER SCENE" WAJIB diturunkan langsung dari deskripsi ini (lokasi, arsitektur, palet, lighting, props tidak boleh berbeda).\n\n`;
    return t;
}


// ===== v5: Jenis konten, Brand Kit, Product Lock =====
function findVariant(category, id) {
    return ((VARIANTS[category] || []).find(v => v.id === id)) || null;
}
function variantBlock(o) {
    if (!o.variant) return '';
    return `═══ JENIS KONTEN: ${o.variant.name.toUpperCase()} (WAJIB DIIKUTI) ═══\n${o.variant.guide}\n\n`;
}
const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
function brandBlock(o) {
    const b = o.brand, p = o.product;
    let t = '';
    if (b && b.name) {
        const rows = [
            ['Nama brand', b.name], ['Slogan', b.slogan], ['Warna brand', b.colors], ['Font / tipografi', b.font],
            ['Tone of voice', b.tone], ['Keunggulan (USP)', b.usp], ['Deskripsi logo', b.logo], ['Catatan', b.notes]
        ].filter(r => r[1]).map(r => `- ${r[0]}: ${r[1]}`).join('\n');
        t += `═══ BRAND KIT (WAJIB DIPATUHI) ═══\n${rows}\n` +
            `ATURAN BRAND: (1) Warna brand dominan pada props, wardrobe, grafis, dan teks di layar. (2) Dialog, voice-over, dan teks layar memakai tone of voice di atas. ` +
            `(3) Logo hanya muncul sesuai deskripsi logo dan tidak diubah bentuk/warnanya. (4) Slogan dipakai di penutup/CTA bila relevan.` +
            (b.forbidden ? ` (5) DILARANG KERAS memakai kata/klaim ini: ${b.forbidden}.` : '') + '\n\n';
    }
    if (p && p.name) {
        const rows = [
            ['Nama produk', p.name], ['Deskripsi fisik PERSIS', p.desc], ['Tulisan pada kemasan/label', p.label],
            ['Ukuran relatif', p.size], ['Wajib terlihat', p.must]
        ].filter(r => r[1]).map(r => `- ${r[0]}: ${r[1]}`).join('\n');
        t += `═══ PRODUCT LOCK (WAJIB, TANPA PENGECUALIAN) ═══\n${rows}\n` +
            `ATURAN PRODUK: Setiap kemunculan produk di [IMAGE PROMPT] dan [VIDEO PROMPT] WAJIB menyalin deskripsi fisik di atas apa adanya (bentuk, warna, proporsi, material, tulisan label, posisi logo). ` +
            `Produk TIDAK BOLEH berubah bentuk, warna, atau tulisan antar adegan dan antar shot; tidak ada teks palsu/acak pada kemasan; produk tetap jadi fokus utama dan dipegang/dipakai secara wajar. ` +
            `Tambahkan ke NEGATIVE VIDEO: product morphing, changing label text, garbled packaging text, extra fake logos.\n\n`;
    }
    return t;
}

function extrasBlock(o) {
    const e = Object.entries(o.extras || {}).filter(([, v]) => v);
    if (!e.length) return '';
    return '═══ PREFERENSI TAMBAHAN USER (WAJIB DIPATUHI) ═══\n' + e.map(([k, v]) => `- ${k}: ${v}`).join('\n') +
        '\nJika "Platform gambar" bukan Midjourney, HAPUS parameter --ar/--style/--v dan tulis rasio dalam kalimat; sesuaikan sintaks prompt dengan platform gambar/video yang dipilih.\n\n';
}

// Fungsi tambahan per menu (single mode) — bagian ekstra di akhir output
const SINGLE_EXTRA = {
    'ide-cerita': ['OUTLINE 3 BABAK untuk konsep rekomendasi (Setup / Konflik / Resolusi + estimasi durasi)', 'SKOR POTENSI VIRAL tiap konsep (1-10) + alasan satu baris', 'IDE SERI: bagaimana konsep terbaik dipecah menjadi 3-6 part'],
    'judul-hook': ['PASANGAN A/B TEST: 3 pasang judul untuk diuji', 'HOOK VISUAL: 3 ide adegan 3 detik pertama (tanpa suara)', 'KATA KUNCI POWER: 10 kata pemicu klik yang relevan'],
    'thumbnail': ['3 VARIAN A/B (komposisi berbeda) masing-masing dengan prompt Inggris', 'NEGATIVE PROMPT', 'CHECKLIST KETERBACAAN di layar HP'],
    'karakter': ['CHARACTER SHEET TURNAROUND PROMPT (satu gambar: depan, 3/4, samping, belakang)', 'NEGATIVE PROMPT khusus karakter', 'RINGKASAN KUNCI KONSISTENSI (satu paragraf Inggris yang bisa ditempel di setiap prompt)'],
    'lokasi': ['NEGATIVE PROMPT khusus lokasi', 'PROMPT BACKGROUND LOOP untuk video (gerakan halus: debu, cahaya, awan)', 'DAFTAR PROPS KUNCI + 5 SUDUT KAMERA yang direkomendasikan', 'RINGKASAN KUNCI LATAR (satu paragraf Inggris yang bisa ditempel di setiap prompt)'],
    'naskah-vo': ['HITUNG KATA & ESTIMASI DURASI baca', 'VERSI PENDEK 15 DETIK', 'CATATAN SSML untuk jeda & penekanan'],
    'script-dialog': ['VERSI RINGKAS 15 DETIK', 'DAFTAR SHOT yang disarankan per baris dialog', 'SUBTITLE-READY: dialog tanpa atribusi, maks 42 karakter per baris'],
    'musik-sfx': ['PROMPT SUNO/UDIO (English, maks 200 karakter, tanpa nama artis)', 'CUE SHEET per detik (kapan musik naik/turun, kapan SFX masuk)', 'DAFTAR SFX SIAP CARI (kata kunci Inggris untuk library SFX)'],
    'seo-caption': ['KOMENTAR PERTAMA (pinned) untuk memancing diskusi', '3 VARIAN CTA', 'JUDUL YOUTUBE SHORTS vs VIDEO PANJANG']
};
function singleExtra(category) {
    const l = SINGLE_EXTRA[category];
    if (!l) return '';
    return '\n\n═══════════════════════════════════════════════════\n   BAGIAN TAMBAHAN WAJIB (tulis di akhir, pakai pemisah ═══ + judul seperti bagian lain)\n═══════════════════════════════════════════════════\n' + l.map((x, i) => `${i + 1}. ${x}`).join('\n');
}

const NO_PREAMBLE = `

═══════════════════════════════════════════════════
   ATURAN OUTPUT AKHIR
═══════════════════════════════════════════════════
- LANGSUNG mulai dari isi sesuai format. TANPA kalimat pembuka/penutup/basa-basi.
- Jangan membungkus output dalam code block markdown.
- Patuhi bahasa yang diminta.`;


// ============================================
// ============ MULTI MODE ====================
// ============================================
const PROMPTS_MULTI = {

    // ========================================
    // VIDEO IKLAN — Multi-Adegan dengan Dialog
    // ========================================
    'video-iklan': (o) => `TASK: Generate storyboard untuk video iklan.

INPUT:
- Jumlah adegan: ${o.adegan}
- Shot per adegan: ${o.shot}
- Durasi: ${o.durasi}
- Aspect ratio: ${o.ratio}
- Bahasa: ${o.lang}
- Max karakter: ${o.char}
- Voice Mode: ${o.voice}
- Style Visual: ${o.style}
${o.hasRef ? `- Referensi: ${o.refCount} gambar` : ''}

⚠️ WAJIB DIPATUHI: Semua [IMAGE PROMPT] dan [VIDEO PROMPT] HARUS mencerminkan style "${o.style}" secara KONSISTEN di seluruh panel & adegan.

CRITICAL LIMIT: Total panel = ${o.adegan * o.shot} panel.
PENTING: Deskripsi setiap panel padat & ringkas (max 2 kalimat per panel).

${timingBlock(o)}

CRITICAL: Output WAJIB punya:
1. Blok "### MASTER SCENE" (WAJIB di awal, sebelum ADEGAN 1)
2. ${o.adegan} blok "### ADEGAN" — masing-masing dengan [IMAGE PROMPT] dan [VIDEO PROMPT]

${rules.GLOBAL_RULES.sceneLockRule}

${rules.GLOBAL_RULES.videoImageSyncRule}

═══════════════════════════════════════════════════
   CONTOH FORMAT (HANYA BENTUK, BUKAN ISI)
═══════════════════════════════════════════════════
⚠️ Contoh di bawah hanya menunjukkan STRUKTUR. JANGAN meniru lokasi, karakter, dialog, atau jumlah shot contoh.
Gunakan IDE USER sebagai sumber cerita, lokasi, dan karakter.

### MASTER SCENE
LOKASI       : Cafe Retro Senja — kedai kopi vintage 1980s di sudut jalan
ARSITEKTUR   : Kayu tua, panel dinding vertikal, jendela besar berbingkai besi
PALET WARNA  : Warm amber (#D97706), coklat tua (#78350F), krem (#FEF3C7), hijau botol (#064E3B)
LIGHTING     : Golden hour dari jendela kanan, warm backlight, soft shadow
WAKTU        : Sore (17:30)
PROPS KUNCI  : Espresso machine chrome, rak cangkir kayu, jam dinding bulat, neon sign "CAFE"
ATMOSFER     : Hangat, tenang, intim, sedikit berdebu

### ADEGAN 1 — Pembukaan Cafe

[IMAGE PROMPT]
Create ONE ${o.ratio} image, FULL BLEED edge-to-edge.
NO outer border. NO frame. NO margin.
${o.shot} stacked panels, thin WHITE lines only.
Panel "1" s/d "${o.shot}" di kiri atas.
MAX ${o.char} KARAKTER TOTAL.
STYLE: ${o.style}
SCENE LOCK: WAJIB pakai MASTER SCENE — Cafe Retro Senja, palet warm amber + coklat tua, golden hour dari kanan, props: espresso machine + neon sign "CAFE".
SINKRONISASI: semua panel momen SAMA.
1 — WIDE SHOT establishing cafe, barista di counter.
2 — MEDIUM SHOT kamera MAJU — barista tersenyum.
3 — CLOSE UP kamera MAJU — tangan menuang kopi.
NEGATIVE: ${rules.GLOBAL_RULES.negativePromptBaku}

[VIDEO PROMPT]
Single continuous full-frame video. Shots play one after another in strict sequence — no split screen, no panels.
SCENE: Cafe Retro Senja (MASTER SCENE, TIDAK BOLEH BERUBAH).
STYLE: ${o.style}
Durasi adegan: ${o.durasi}
SCENE LOCK: palet, lighting, props SAMA dengan MASTER SCENE.

CHARACTER REGISTRY:
[CHAR_1] Rian — pria 25 tahun, barista
[CHAR_2] Sarah — wanita 22 tahun, pelanggan

SHOT TIMELINE:
SHOT 1: [00:00.0-00:01.7] WIDE — establishing cafe
SHOT 2: [00:01.7-00:03.4] MEDIUM — barista senyum
SHOT 3: [00:03.4-00:05.0] CLOSE UP — menuang kopi

SETTING: Cafe Retro Senja (SAMA seperti adegan berikutnya)
CAMERA MOVEMENT: Dolly in progresif

VOICE MAPPING:
[CHAR_1] Rian → Baritone, hangat, Jakarta accent
[CHAR_2] Sarah → Soprano, ceria, netral

TIMELINE DIALOG
---------------
[00:00.0-00:01.7] [CHAR_1] Rian: "Selamat sore!"
[00:01.7-00:03.4] [CHAR_2] Sarah: "Kopi susu satu ya."
[00:03.4-00:05.0] [No dialog]

AUDIO / SFX:
[FI]  [0.00-0.30]  Fade in
[AMB] [0.00-5.0]   Cafe ambience 35%
[SFX] SHOT 1 [0.0-1.7] Door chime
[SFX] SHOT 2 [1.7-3.4] Cup clink
[DRN] [3.4-5.0]    Drone warm
[FO]  [4.7-5.0]    Fade out
NEGATIVE VIDEO: ${rules.GLOBAL_RULES.negativeVideo}

### ADEGAN 2 — Interaksi
[ulangi format — SETTING, palet, lighting, props HARUS SAMA dengan MASTER SCENE]

[lanjutkan sampai ADEGAN ${o.adegan}]

═══════════════════════════════════════════════════
   SEKARANG GENERATE
═══════════════════════════════════════════════════

1. Tulis dulu "### MASTER SCENE" dengan detail lengkap
2. Lalu tulis "### ADEGAN 1" sampai "### ADEGAN ${o.adegan}"
3. SEMUA adegan WAJIB pakai MASTER SCENE yang SAMA
4. Setiap adegan WAJIB punya [IMAGE PROMPT] dan [VIDEO PROMPT]
5. Setiap [IMAGE PROMPT] WAJIB cantumkan "SCENE LOCK: ..."
6. SHOT N di SHOT TIMELINE WAJIB = PANEL N di [IMAGE PROMPT] adegan yang sama (aksi/objek/tipe shot identik). DILARANG mengarang aksi/objek baru di video yang tidak ada di panel pasangannya.

${rules.GLOBAL_RULES.aturanDialog}`,

    // ========================================
    // KONTEN SOSMED
    // ========================================
    'konten-sosmed': (o) => `TASK: Generate paket konten sosmed lengkap.

PROYEK:
- Platform: ${o.platform}
- Tipe: ${o.contentType}
- Adegan: ${o.adegan} × Shot: ${o.shot} = ${o.adegan * o.shot} panel
- Durasi: ${o.durationTarget}
- Aspect: ${o.aspectRatio}
- Tone: ${o.tone}
- Target: ${o.audienceTarget}
- Bahasa: ${o.lang}
- Format: ${o.videoFormat}
- Voice: ${o.voice}
- Musik: ${o.musicBg}
- Style Visual: ${o.styleVisual}
${o.keyword ? `- Keyword SEO: ${o.keyword}` : ''}

⚠️ WAJIB DIPATUHI: Semua deskripsi shot & visual HARUS konsisten dengan style "${o.styleVisual}".

CRITICAL LIMIT: Total panel = ${o.adegan * o.shot} panel.

${rules.GLOBAL_RULES.sceneLockRule}

OUTPUT FORMAT — WAJIB 6 BAGIAN:

═══════════════════════════════════════════════════
   [A] HOOK VIRAL (${o.hookCount} Opsi)
═══════════════════════════════════════════════════
1. [Hook 1]
2. [Hook 2]
3. [Hook 3]
... sampai ${o.hookCount}

🏆 REKOMENDASI: Pilih #X + alasan singkat.

═══════════════════════════════════════════════════
   [B] JUDUL VIDEO (${o.titleCount} Opsi)
═══════════════════════════════════════════════════
1. [Judul 1]
2. [Judul 2]
... sampai ${o.titleCount}

🏆 REKOMENDASI: Pilih #X + alasan.

═══════════════════════════════════════════════════
   [C] MASTER SCENE (WAJIB)
═══════════════════════════════════════════════════

### MASTER SCENE
LOKASI       : [nama + deskripsi 1 kalimat]
ARSITEKTUR   : [gaya & material]
PALET WARNA  : [3-5 warna dominan]
LIGHTING     : [jenis + arah + intensitas]
WAKTU        : [jam/waktu hari]
PROPS KUNCI  : [3-5 objek yang wajib muncul]
ATMOSFER     : [mood/suasana]

═══════════════════════════════════════════════════
   [D] BREAKDOWN PER ADEGAN (${o.adegan} Adegan)
═══════════════════════════════════════════════════

**ADEGAN 1 — [Judul]** (±${o.contentSecPerScene}s)
📍 Scene: SAMA dengan MASTER SCENE

CHARACTER REGISTRY:
[CHAR_1] [Nama] — [deskripsi]

SHOT 1.1 [TIPESHOT] — [deskripsi visual]
  Scene Lock: palet/lighting/props SAMA MASTER SCENE
  Dialog: [CHAR_1] [Nama]: "[dialog]"
  Audio/SFX: [efek]

SHOT 1.2 [TIPESHOT] — [deskripsi]
  Dialog: [CHAR_1] [Nama]: "[dialog]"
  Audio/SFX: [efek]

[lanjutkan sampai SHOT 1.${o.shot}]

[ulangi ADEGAN 2..${o.adegan} — SEMUA pakai Scene: SAMA MASTER SCENE]

═══════════════════════════════════════════════════
   [E] DISTRIBUSI
═══════════════════════════════════════════════════
**Caption:**
[2-3 baris + emoji untuk ${o.platform}]

**Hashtag (15-20 tag):**
🔥 Trending: #tag1 #tag2 #tag3
🎯 Niche: #tag1 #tag2 #tag3
📍 Lokal: #tag1 #tag2

**SEO & Tips:**
- Deskripsi: [2 baris]
- Best posting time: [hari + jam WIB]
- Tips boost algorithm ${o.platform}

═══════════════════════════════════════════════════
   [F] PRODUCTION NOTES
═══════════════════════════════════════════════════
- Total durasi: ${o.durationTarget}
- Aspect ratio: ${o.aspectRatio}
- Style visual: ${o.styleVisual}
- Scene: SAMA untuk semua adegan (lihat MASTER SCENE)
- Editing tips: [cutting pace, transitions]
- Music mood: ${o.musicBg}
- Shot priority: [urut dari hook ke CTA]

${rules.GLOBAL_RULES.aturanDialog}`,

    // ========================================
    // ANIMASI CERITA
    // ========================================
    'animasi-cerita': (o) => `TASK: Generate storyboard animasi.

PROYEK:
- Gaya Animasi: ${o.animStyle}
- Style Visual: ${o.style}
- Frame Rate: ${o.fps}
- Palette: ${o.palette}
- Adegan: ${o.adegan} × Shot: ${o.shot} = ${o.adegan * o.shot} panel
- Durasi: ${o.durasi}
- Aspect: ${o.ratio}
- Bahasa: ${o.lang}
${o.hasRef ? `- Referensi: ${o.refCount} gambar` : ''}

⚠️ WAJIB: Kombinasikan gaya animasi "${o.animStyle}" dengan style visual "${o.style}" secara KONSISTEN.

CRITICAL LIMIT: Total panel = ${o.adegan * o.shot} panel.

${timingBlock(o)}

${rules.GLOBAL_RULES.sceneLockRule}

${rules.GLOBAL_RULES.videoImageSyncRule}

CRITICAL: Output WAJIB punya:
1. Blok "### MASTER SCENE" (WAJIB di awal)
2. ${o.adegan} blok "### ADEGAN"

═══════════════════════════════════════════════════
   FORMAT OUTPUT
═══════════════════════════════════════════════════

### MASTER SCENE
LOKASI       : [nama + deskripsi]
ARSITEKTUR   : [gaya & material]
PALET WARNA  : [3-5 warna — SESUAI dengan palette "${o.palette}"]
LIGHTING     : [jenis + arah]
WAKTU        : [jam/waktu]
PROPS KUNCI  : [3-5 objek wajib]
ATMOSFER     : [mood]

### ADEGAN 1 — [Judul Adegan 1]

[IMAGE PROMPT]
${o.animStyle} style, ${o.style}, FULL BLEED, ${o.ratio}
${o.shot} stacked panels, thin WHITE lines.
Color palette: ${o.palette}
Panel "1" s/d "${o.shot}" di kiri atas.
MAX ${o.char} KARAKTER TOTAL.
SCENE LOCK: WAJIB pakai MASTER SCENE — lokasi/palet/lighting/props SAMA.
1 — [TIPESHOT] [deskripsi visual — di MASTER SCENE]
2 — [TIPESHOT] kamera MAJU — [deskripsi]
[lanjutkan sampai panel ${o.shot}]
NEGATIVE: ${rules.GLOBAL_RULES.negativePromptBaku}

[VIDEO PROMPT]
Single continuous full-frame video. Shots play one after another in strict sequence — no split screen, no panels.
${o.animStyle} animation, ${o.style}, ${o.fps}
SCENE: [MASTER SCENE — TIDAK BOLEH BERUBAH]
Durasi: ${o.durasi}
SCENE LOCK: palet, lighting, props SAMA.

CHARACTER REGISTRY:
[CHAR_1] [Nama] — [deskripsi]

⚠️ WAJIB: SHOT N = PANEL N di [IMAGE PROMPT] adegan ini (aksi/objek/tipe shot identik, hanya ditambah gerakan). DILARANG mengarang aksi/objek baru di video.
SHOT TIMELINE:
SHOT 1: [00:00.0-00:0X.X] [TIPESHOT] — [SAMA dengan PANEL 1 + gerakan wajar]
[lanjutkan sampai shot ${o.shot} = panel ${o.shot}]

SETTING: MASTER SCENE (SAMA untuk semua adegan)
CAMERA MOVEMENT: [gerakan]
ANIMATION MOTION: [squash & stretch, lip-sync]

VOICE MAPPING:
[CHAR_1] [Nama] → [tipe suara, tone]

TIMELINE DIALOG
---------------
[00:00.0-00:0X.X] [CHAR_1] [Nama]: "[dialog]"
[00:0X.X-00:0X.X] [No dialog]

AUDIO / SFX:
${rules.GLOBAL_RULES.audioLayoutTemplate}
NEGATIVE VIDEO: ${rules.GLOBAL_RULES.negativeVideo}

### ADEGAN 2 — [Judul Adegan 2]
📍 Scene: SAMA dengan MASTER SCENE
[ulangi format]

[lanjutkan sampai ADEGAN ${o.adegan}]

═══════════════════════════════════════════════════
   VALIDASI DIRI SEBELUM OUTPUT
═══════════════════════════════════════════════════
✓ Apakah MASTER SCENE sudah ditulis di awal?
✓ Apakah SEMUA adegan pakai lokasi yang sama?
✓ Apakah palet warna identik di semua adegan?
✓ Apakah lighting konsisten?
✓ Apakah SHOT N di video = PANEL N di gambar (aksi/objek sama, tidak ada yang diarang)?
✓ Apakah props kunci muncul di setiap adegan?

${rules.GLOBAL_RULES.aturanDialog}`
};


// ============================================
// MENU PRODUKSI v4.0 — FACTORY STORYBOARD
// ============================================
const AUDIO_BLOCK = {
    dialog: `CHARACTER REGISTRY:
[CHAR_1] [Nama] — [deskripsi fisik singkat]

VOICE MAPPING:
[CHAR_1] [Nama] → [tipe suara, tone, aksen]

TIMELINE DIALOG
---------------
[00:00.0-00:0X.X] [CHAR_1] [Nama]: "[dialog]"
[00:0X.X-00:0X.X] [No dialog]`,
    vo: `VOICE NARASI: [tipe suara, tempo, tone — konsisten di semua adegan]

TIMELINE NARASI
---------------
[00:00.0-00:0X.X] NARATOR: "[narasi, ±2.5 kata/detik]"
TEXT OVERLAY: [teks layar singkat + waktu tampil, hanya bila diminta]`,
    sound: `SOUND DESIGN (per shot): sumber suara · tekstur · jarak mikrofon · stereo (L/R/binaural) · level
[No dialog]`
};

function storyboard(cfg) {
    return (o) => `TASK: ${cfg.task}

INPUT:
- Jumlah adegan: ${o.adegan} · Shot per adegan: ${o.shot} (total ${o.adegan * o.shot} panel)
- Durasi per adegan: ${o.durasi} · Rasio: ${o.ratio} · Bahasa: ${o.lang}
- Maks karakter: ${o.char} · Voice Mode: ${o.voice}
- Style Visual: ${o.style}
${o.hasRef ? `- Referensi: ${o.refCount} gambar (tiap gambar diberi label kategori; ${cfg.refRule})` : '- Referensi: tidak ada'}

⚠️ Style "${o.style}" WAJIB konsisten di semua panel & adegan.
CRITICAL LIMIT: Total panel = ${o.adegan * o.shot}. Deskripsi tiap panel padat (maks 2 kalimat).

${timingBlock(o)}

═══════════════════════════════════════════════════
   ATURAN KHUSUS MENU INI — PRIORITAS TERTINGGI
   (jika bertentangan dengan aturan umum di atas, aturan ini yang dipakai)
═══════════════════════════════════════════════════
${cfg.brief}

${cfg.lock === 'timelapse' ? rules.GLOBAL_RULES.sceneLockTimelapse : rules.GLOBAL_RULES.sceneLockRule}

${rules.GLOBAL_RULES.videoImageSyncRule}

═══════════════════════════════════════════════════
   FORMAT OUTPUT
═══════════════════════════════════════════════════
### MASTER SCENE
(isi sesuai blok scene lock di atas)

### ADEGAN 1 — [Judul]

[IMAGE PROMPT]
Create ONE ${o.ratio} image, FULL BLEED edge-to-edge. NO outer border/frame/margin.
${o.shot} stacked panels separated by thin WHITE lines. Panel number "1".."${o.shot}" at top-left of each panel.
MAX ${o.char} KARAKTER TOTAL. STYLE: ${o.style}
SCENE LOCK: [ringkas MASTER SCENE]
SINKRONISASI: semua panel = momen yang sama, hanya sudut & jarak kamera berbeda.
1 — [WD/MD/CU] [deskripsi]
2 — [WD/MD/CU] kamera MAJU — [deskripsi]
[... sampai panel ${o.shot}]
NEGATIVE: ${rules.GLOBAL_RULES.negativePromptBaku}

[VIDEO PROMPT]
Single continuous full-frame video. Shots play one after another in strict sequence — no split screen, no panels.
SCENE: [MASTER SCENE]  ·  STYLE: ${o.style}  ·  Durasi: ${o.durasi}
${cfg.videoFields}

⚠️ WAJIB: baca ulang PANEL 1..${o.shot} di [IMAGE PROMPT] adegan ini. SHOT N di bawah = PANEL N (aksi/pose/objek/tipe shot SAMA), hanya ditambah gerakan kamera & gerak wajar. DILARANG mengarang aksi/objek baru yang tidak ada di panel pasangannya.
SHOT TIMELINE (berurutan, tidak tumpang tindih, ${o.perShot}s per shot):
SHOT 1: [00:00.0-00:0X.X] [WD/MD/CU] — [SAMA dengan PANEL 1: aksi/objek identik + gerakan wajar]
[... sampai SHOT ${o.shot} = PANEL ${o.shot}, berakhir tepat di ${o.durasi}]
CAMERA MOVEMENT: [satu gerakan per shot]

${AUDIO_BLOCK[cfg.audio]}

AUDIO / SFX:
${rules.GLOBAL_RULES.audioLayoutTemplate}
NEGATIVE VIDEO: ${rules.GLOBAL_RULES.negativeVideo}

[ulangi format untuk ### ADEGAN 2 sampai ### ADEGAN ${o.adegan}]
${cfg.tail}

${cfg.audio === 'dialog' ? rules.GLOBAL_RULES.aturanDialog : ''}`;
}

const CAPTION_TAIL = `\n\n═══════════════════════════════════════════════════
   CAPTION & HASHTAG
═══════════════════════════════════════════════════
Caption (2-3 baris + emoji) · 15 hashtag (trending/niche/lokal) · komentar pertama (pinned) · jam posting terbaik WIB.`;

Object.assign(PROMPTS_MULTI, {
    'fakta-unik': storyboard({
        task: 'Generate storyboard video FAKTA UNIK (edukasi singkat yang viral dan akurat).',
        refRule: 'pakai sebagai acuan bentuk subjek fakta / host; jangan diubah',
        audio: 'vo',
        videoFields: 'FAKTA SHOT INI: [satu fakta/ide per shot]\nVISUAL: [macro / infografis / rekonstruksi / perbandingan skala]',
        brief: `- Struktur: HOOK mengejutkan (shot pertama, ≤3 detik) → fakta berurutan dari biasa → menarik → PALING mengejutkan → twist/penutup + CTA follow.
- Hanya fakta yang dapat diverifikasi. JANGAN mengarang angka/nama/tahun. Jika ragu, pakai "sekitar" atau rentang.
- Visual = ILUSTRASI fakta (macro, perbandingan skala, animasi infografis, rekonstruksi), bukan orang sekadar berbicara.
- Narasi ringkas ±2.5 kata/detik. Satu shot = satu ide. Kata kunci/angka penting boleh jadi TEXT OVERLAY (bila preferensi user mengizinkan).
- Jika host dipakai, daftarkan sebagai karakter dan jaga konsistensi wajah.`,
        tail: `\n\n═══════════════════════════════════════════════════
   DAFTAR FAKTA & TINGKAT KEPASTIAN
═══════════════════════════════════════════════════
Tiap fakta: isi · tingkat kepastian (Pasti / Umumnya diterima / Perlu dicek) · kata kunci untuk verifikasi.` + CAPTION_TAIL
    }),

    'objek-bicara': storyboard({
        task: 'Generate storyboard video OBJEK BERBICARA (benda sehari-hari hidup, berwajah, bicara dengan lip-sync).',
        refRule: 'bentuk, warna, material, dan logo objek WAJIB sama dengan foto',
        audio: 'dialog',
        videoFields: 'OBJEK AKTOR: [nama objek + posisi wajah]\nLIP-SYNC: mulut membuka sesuai suku kata dialog; objek diam saat tidak bicara',
        brief: `- Setiap objek yang bicara = karakter: daftarkan di CHARACTER REGISTRY dengan DESAIN WAJAH (posisi & ukuran mata/mulut pada badan objek, ekspresi khas), material, warna, skala. Wajah IDENTIK di semua panel.
- Bentuk/warna/logo objek sama persis dengan foto referensi. Jangan menambah tangan/kaki kecuali diminta di preferensi.
- Gerak: squash & stretch ringan, goyang kecil, lompat kecil. Mulut sinkron dengan dialog; saat diam, ekspresi tetap hidup (kedip, alis).
- Setiap objek punya SUARA & gaya bicara berbeda (pitch, tempo, aksen) di VOICE MAPPING.
- 3 detik pertama: objek langsung bicara/protes/curhat (hook). Dialog pendek, punchline jelas, maks 12 kata per baris.
- Dilarang objek lain yang tidak terdaftar muncul bicara.`,
        tail: CAPTION_TAIL
    }),

    'affiliate': storyboard({
        task: 'Generate storyboard video AFFILIATE / REVIEW PRODUK yang natural dan mendorong checkout.',
        refRule: 'foto produk = acuan mutlak bentuk, warna, kemasan, label, logo; foto creator = acuan wajah',
        audio: 'dialog',
        videoFields: 'PRODUK DI FRAME: [bagian produk yang tampil di shot ini]\nAKSI PRODUK: [dipegang / dipakai / dibuka / dibandingkan]',
        brief: `- PRODUK adalah bintang: tampil jelas di minimal 70% panel. Bentuk, warna, kemasan, label & logo SAMA PERSIS dengan foto referensi. Jangan mengarang teks/logo yang tidak ada di referensi.
- Struktur: HOOK masalah (≤3 detik) → perkenalan produk → demo penggunaan (close up fitur) → bukti/hasil → CTA sesuai marketplace di preferensi.
- Gaya UGC natural (handheld ringan, cahaya realistis), bukan terlalu sinematik, kecuali style visual menyatakan lain.
- KLAIM AMAN: dilarang klaim medis/berlebihan, janji hasil pasti, angka palsu, atau menjelekkan merek lain. Gunakan "membantu", "terasa", "menurut pengalaman".
- Sebut USP, harga, dan promo HANYA jika diberikan user di preferensi/ide.
- Jika "faceless/tangan saja": tidak ada wajah; fokus tangan + produk + voice-over.`,
        tail: `\n\n═══════════════════════════════════════════════════
   PAKET AFFILIATE
═══════════════════════════════════════════════════
3 versi caption (singkat / storytelling / hard-sell halus) · komentar pinned berisi link/CTA · 15 hashtag · 3 pertanyaan calon pembeli + jawaban siap tempel · disclaimer singkat.`
    }),

    'drama-pendek': storyboard({
        task: 'Generate storyboard DRAMA PENDEK bernarasi kuat dengan emosi berkembang.',
        refRule: 'foto tokoh = acuan wajah, rambut, outfit; foto lokasi = acuan latar',
        audio: 'dialog',
        videoFields: 'EMOSI ADEGAN: [emosi + subteks]\nBLOCKING: [posisi & gerak karakter yang bersambung dari shot sebelumnya]',
        brief: `- Struktur mikro: SETUP (hook konflik ≤3 detik) → ESKALASI → KLIMAKS/TWIST → ENDING sesuai preferensi user.
- Tiap adegan tulis EMOSI + SUBTEKS. Emosi harus naik/berubah, bukan datar.
- Dialog natural, pendek (maks 12 kata/baris), subteks lebih penting daripada eksposisi. Tiap tokoh punya gaya bicara berbeda.
- CLOSE UP dipakai di puncak emosi; WIDE hanya untuk establishing.
- Wajah, rambut, outfit, dan posisi lokasi konsisten di semua adegan (lihat CHARACTER REGISTRY).`,
        tail: `\n\n═══════════════════════════════════════════════════
   LOGLINE & KURVA EMOSI
═══════════════════════════════════════════════════
Logline 1 kalimat · kurva emosi per adegan (angka 1-10) · judul alternatif (3).` + CAPTION_TAIL
    }),

    'timelapse': storyboard({
        task: 'Generate storyboard video TIMELAPSE (perubahan waktu/progres dengan kamera terkunci).',
        refRule: 'foto lokasi = sudut kamera & framing tetap; foto awal/akhir = keadaan awal dan hasil akhir',
        lock: 'timelapse', audio: 'sound',
        videoFields: 'TIME STAGE: [jam / tahap progres shot ini]\nTIMELAPSE SPEED: [mis. 1 detik = 30 menit]\nLOCKED CAMERA: [framing yang sama]',
        brief: `- Kamera STATIS (tripod terkunci); sudut & framing SAMA di semua panel/adegan, kecuali "Gerak kamera" di preferensi user menyatakan lain. Aturan "maksimal 1 WIDE" & kombinasi WD/MD/CU diabaikan: pakai framing yang sama; satu CU detail di shot terakhir boleh.
- Yang berubah = WAKTU/PROGRES, tertulis di TIME PROGRESSION (naik berurutan, tidak mundur).
- Gerak cepat tersirat: awan melaju, bayangan berputar, orang berlalu-lalang sebagai motion blur, tanaman tumbuh, bangunan naik, lampu menyala.
- Subjek utama tidak berpindah; hanya progresnya yang berubah. Manusia hanya jejak gerak (blur) kecuali diminta.
- Shot terakhir = REVEAL hasil akhir yang jelas dan memuaskan.
- Audio: ambience dipercepat + musik build-up (sesuai preferensi), tanpa dialog.`,
        tail: `\n\n═══════════════════════════════════════════════════
   PANDUAN RENDER TIMELAPSE
═══════════════════════════════════════════════════
Interval frame yang disarankan · speed ramp (kapan melambat untuk reveal) · tips konsistensi eksposur antar adegan · saran musik build-up.` + CAPTION_TAIL
    }),

    'podcast': storyboard({
        task: 'Generate storyboard video PODCAST / talk-show pendek (clip highlight atau full segment pendek).',
        refRule: 'foto host/tamu = acuan wajah & outfit; foto studio = acuan set',
        audio: 'dialog',
        videoFields: 'MIC: [posisi mikrofon]\\nSET: [sudut kamera studio]\\nREACTION: [reaksi lawan bicara]',
        brief: `- Format podcast: host (+ tamu opsional) di set studio/mini-studio dengan mikrofon, meja, dan pencahayaan hangat.
- Fokus pada percakapan natural, reaction shot, dan close-up saat punchline/insight.
- Character Dialogue / Lip-Sync wajib konsisten dengan CHARACTER REGISTRY.
- Struktur: intro hook (topik) → percakapan inti (2–3 poin) → closing/CTA (subscribe / follow / episode penuh).
- Visual: medium shot host, over-the-shoulder, close-up wajah saat emosi, detail mikrofon/props meja.
- Hindari split-screen di video; gunakan hard cut antar shot berurutan.
- Bahasa dialog sesuai preferensi user; natural, tidak kaku.`,
        tail: `\n\n═══════════════════════════════════════════════════
   CATATAN PRODUKSI PODCAST
═══════════════════════════════════════════════════
Tips framing multi-kamera · sinkron lip-sync · level audio dialog vs ambience · CTA episode.` + CAPTION_TAIL
    }),

    'asmr': storyboard({
        task: 'Generate storyboard video ASMR VISUAL yang satisfying dengan SOUND DESIGN detail.',
        refRule: 'foto objek/bahan = acuan tekstur dan warna; foto tangan = acuan gaya tangan',
        audio: 'sound',
        videoFields: 'TRIGGER: [suara pemicu utama shot ini]\nTEXTURE: [tekstur yang terlihat]\nMIC: [jarak & posisi mikrofon]\nWHISPER: [hanya bila dipilih user]',
        brief: `- SUARA adalah bintang: tiap shot punya TRIGGER SOUND utama (tapping, scratching, slicing, crunch, pouring, brushing, squishing, dll) yang disebut jelas.
- Visual close up/macro, gerakan lambat & halus, tangan/objek saja (wajah tidak tampil kecuali diminta). Tekstur hyperreal, depth of field tipis, cahaya lembut tanpa kilau keras.
- Tanpa dialog. Whisper hanya jika user memilihnya di preferensi.
- Ritme: pelan → build → puncak satisfying → tenang. Beri jeda hening 0.3–0.5 detik antar trigger.
- Dilarang musik keras; boleh ambience sangat rendah.
- Tulis SOUND DESIGN per shot: sumber suara, tekstur, jarak mikrofon, stereo (L/R/binaural), level.`,
        tail: `\n\n═══════════════════════════════════════════════════
   PANDUAN AUDIO & LOOP
═══════════════════════════════════════════════════
Urutan trigger terbaik · tips merekam/mixing (EQ, noise floor) · cara membuat loop mulus · tips headphone.` + CAPTION_TAIL
    }),

    'konten-kreatif': storyboard({
        task: 'Generate storyboard VIDEO KONTEN KREATIF (ide bebas: skit komedi, tren/challenge, visual art, eksperimen kreatif, atau format orisinal lain sesuai ide user) dengan eksekusi rapi dan menarik.',
        refRule: 'pakai sebagai acuan bentuk karakter/objek/lokasi; jangan diubah dari referensi',
        audio: 'dialog',
        videoFields: 'IDE KREATIF SHOT INI: [elemen kreatif/twist yang ditonjolkan di shot ini]\nVISUAL: [gaya eksekusi: skit / stop-motion feel / transisi kreatif / efek visual / dll sesuai ide]',
        brief: `- Ide bebas & fleksibel: ikuti ide/konsep dari user apa adanya (bisa skit komedi, tren/challenge, eksperimen visual, seni, atau format lain) — JANGAN mengubah konsep inti, hanya kembangkan jadi storyboard yang eksekusinya rapi.
- Struktur: HOOK kreatif/unik (≤3 detik, bikin penasaran) → pengembangan ide secara bertahap & logis → puncak/twist/"wow moment" → penutup/CTA sesuai preferensi.
- Orisinalitas diutamakan: hindari klise yang membosankan; cari sudut pandang, transisi, atau visual yang segar selama tetap konsisten dengan ide user.
- Jika ada karakter/objek/lokasi, daftarkan di CHARACTER REGISTRY dan jaga konsistensi wajah/bentuk/warna di semua panel & adegan.
- Dialog (bila ada) natural & singkat (maks 12 kata/baris); bila tanpa dialog, gunakan narasi/VO atau murni visual+sound design sesuai preferensi user.
- Transisi antar adegan boleh kreatif (match cut, whip pan, morph) selama tetap mengikuti aturan video sequential (tidak split-screen, shot berurutan).`,
        tail: `\n\n═══════════════════════════════════════════════════
   CATATAN IDE KREATIF
═══════════════════════════════════════════════════
Ringkasan konsep kreatif 1 kalimat · elemen "wow moment" yang ditonjolkan · variasi ide alternatif (2) untuk versi lain.` + CAPTION_TAIL
    })
});

// ============================================
// ============ SINGLE MODE ===================
// ============================================
const PROMPTS_SINGLE = {

    // ========================================
    // IDE CERITA
    // ========================================
    'ide-cerita': (o) => `TASK: Beri 5-10 KONSEP VIDEO dari ide kasar user.

KONTEKS:
- Platform: ${o.platform}
- Tone: ${o.tone}
- Target: ${o.audienceTarget}
- Bahasa: ${o.lang}
${o.keyword ? `- Keyword: ${o.keyword}` : ''}

FORMAT OUTPUT:

═══════════════════════════════════════════════════
   IDE CERITA UNTUK VIDEO
═══════════════════════════════════════════════════

▶ KONSEP 1 — [Judul Konsep]
Premise : [1 kalimat inti cerita]
Hook    : [kalimat pembuka 3 detik]
Pesan   : [pesan utama]
Audiens : [siapa yang cocok nonton]

▶ KONSEP 2 — [Judul Konsep]
Premise : [...]
Hook    : [...]
Pesan   : [...]
Audiens : [...]

[lanjutkan sampai 5-10 konsep]

═══════════════════════════════════════════════════
   🏆 REKOMENDASI
═══════════════════════════════════════════════════
Pilih   : KONSEP [X]
Alasan  : [kenapa konsep ini paling kuat]

Tulis bahasa ${o.lang}, tone ${o.tone}.`,

    // ========================================
    // JUDUL & HOOK
    // ========================================
    'judul-hook': (o) => `TASK: Buat judul & hook untuk ${o.platform}.

KONTEKS:
- Tone: ${o.tone}
- Target: ${o.audienceTarget}
- Bahasa: ${o.lang}

FORMAT OUTPUT:

═══════════════════════════════════════════════════
   JUDUL VIDEO (10 OPSI)
═══════════════════════════════════════════════════
1. [Judul 1]
2. [Judul 2]
3. [Judul 3]
4. [Judul 4]
5. [Judul 5]
6. [Judul 6]
7. [Judul 7]
8. [Judul 8]
9. [Judul 9]
10. [Judul 10]

═══════════════════════════════════════════════════
   HOOK 3 DETIK (5 OPSI)
═══════════════════════════════════════════════════
1. "[Hook pertanyaan]"
2. "[Hook statement mengejutkan]"
3. "[Hook angka/fakta]"
4. "[Hook cerita personal]"
5. "[Hook twist/kontroversi]"

═══════════════════════════════════════════════════
   🏆 REKOMENDASI
═══════════════════════════════════════════════════
Judul terbaik : #[X] — [judul]
Hook terbaik  : #[X] — [hook]
Alasan        : [kenapa kombinasi ini viral]

Bahasa: ${o.lang} · Tone: ${o.tone}`,

    // ========================================
    // THUMBNAIL
    // ========================================
    'thumbnail': (o) => `TASK: Buat konsep thumbnail untuk ${o.platform}.

KONTEKS:
- Tone: ${o.tone}
- Target: ${o.audienceTarget}
- Bahasa: ${o.lang}

FORMAT OUTPUT:

═══════════════════════════════════════════════════
   THUMBNAIL CONCEPT
═══════════════════════════════════════════════════

📐 UKURAN
[1280x720 YouTube / 1080x1920 ${o.platform}]

🎨 VISUAL UTAMA
[Deskripsi scene utama: siapa, di mana, aksi apa]

😲 EKSPRESI
[Ekspresi karakter: kaget/senang/serius]

🎯 ELEMEN FOKUS
[Objek paling menonjol di thumbnail]

📝 TEXT OVERLAY (3-5 kata)
1. "[Opsi 1]"
2. "[Opsi 2]"
3. "[Opsi 3]"

🎨 WARNA DOMINAN
[3 warna + alasan psikologis]

💡 TIP DESAIN
- Kontras tinggi antara text & background
- Wajah karakter 40% frame
- Maksimal 5 kata
- Font tebal & mudah dibaca di layar kecil

🖼️ PROMPT GENERATE (English)
[Prompt bahasa Inggris untuk bikin thumbnail di Midjourney/DALL-E]

═══════════════════════════════════════════════════
   🏆 REKOMENDASI
═══════════════════════════════════════════════════
Text terbaik: "[pilihan]" — alasan: [...]`,

    // ========================================
    // KARAKTER (MULTI-ANGLE)
    // ========================================
    'karakter': (o) => `TASK: Buat paket karakter LENGKAP dengan MULTI-ANGLE views.

${o.hasRef ? `Referensi: ${o.refCount} gambar` : ''}

${o.charDetails ? `JENIS SUBJEK: ${o.charDetails.subjectType || 'Manusia'}
⚠️ ATURAN ADAPTASI ISTILAH (WAJIB): Subjek di atas BISA BERUPA manusia, hewan, makhluk fantasi, robot/AI/mecha, objek hidup, atau kendaraan berkarakter.
Sesuaikan SEMUA istilah anatomi & deskripsi dengan jenis subjek, JANGAN paksakan istilah manusia ke subjek non-manusia:
- "Kulit" → bisa jadi bulu/sisik/cangkang/material logam-kaca-kayu/cat/tekstur permukaan, sesuai field "Warna/Corak/Material" di bawah.
- "Rambut" → bisa jadi bulu, sisik, antena, kabel, atau tidak ada sama sekali.
- "Mata" → bisa jadi mata majemuk, lensa/sensor, lampu LED, atau tidak bermata (sensor tersembunyi).
- "Postur/anatomi tubuh" → bisa quadruped (4 kaki), serpentine (seperti ular), bersayap, beroda, atau bentuk non-biologis lain; JANGAN gambarkan 2 kaki + 2 tangan jika subjek bukan humanoid.
- Jika subjek adalah objek hidup / kendaraan, deskripsikan ekspresi & "wajah" (jika ada) sebagai desain yang ditempelkan/terintegrasi pada bentuk aslinya, bukan wajah manusia.

DETAIL KARAKTER:
Nama: ${o.charDetails.name || '(tidak disebut)'}
Gender/penanda: ${o.charDetails.gender} · Usia/tahap hidup: ${o.charDetails.age}
Spesies/Ras/Tipe model: ${o.charDetails.ethnic || '-'}
Warna/Corak/Material utama: ${o.charDetails.skin || '-'}
Rambut/Bulu/Tekstur kepala: ${o.charDetails.hair || '-'} · Mata/Sensor: ${o.charDetails.eyes || '-'}
Bentuk/Postur tubuh: ${o.charDetails.body || '-'}
Pakaian/Pelapis/Armor: ${o.charDetails.outfit || '-'}
Aksesoris/Fitur tambahan (ekor, sayap, roda, dll): ${o.charDetails.acc || '-'}
Ciri khas unik: ${o.charDetails.mark || '-'}
Kepribadian: ${o.charDetails.personality}
Skala ukuran: ${o.charDetails.scale || 'Normal / sesuai aslinya'}
Gaya: ${o.charDetails.style}
Referensi Style: ${o.charDetails.ref}
Konsistensi ID: ${o.charDetails.consistency || 'Kunci warna & outfit penuh'}` : ''}

FORMAT OUTPUT — WAJIB 6 BAGIAN:

═══════════════════════════════════════════════════
   [A] MAIN CHARACTER PROMPT (English)
═══════════════════════════════════════════════════
[Prompt lengkap sesuai JENIS SUBJEK: age/stage, gender atau "N/A" jika tidak berlaku, species/material, color/pattern, texture (fur/scale/metal/wood/glass dll), eyes/sensors, body shape & limbs, outfit/plating, accessories, unique marks. Gunakan istilah yang sesuai subjek — jangan paksakan istilah manusia untuk hewan/robot/objek/kendaraan]
Style: ${o.charDetails ? o.charDetails.style : 'photorealistic, cinematic'}
Lighting: cinematic studio
Camera: portrait medium shot
Background: neutral dark
--ar 1:1 --style raw

═══════════════════════════════════════════════════
   [B] MULTI-ANGLE VIEWS (6 English Prompts)
═══════════════════════════════════════════════════
Setiap angle menampilkan karakter SAMA dengan outfit & fitur yang sama.

1. FRONT VIEW:
[Full body front view, arms relaxed at sides, neutral expression]

2. 3/4 FRONT VIEW:
[3/4 angle from front-left, slight turn, natural pose]

3. SIDE PROFILE:
[Full body side profile view, showing silhouette]

4. BACK VIEW:
[Full body back view, showing hair back, outfit details]

5. CLOSE-UP FACE:
[Extreme close-up face, detailed skin texture, eyes, expression]

6. ACTION VIEW:
[Dynamic action pose, movement captured, cinematic angle]

Setiap prompt multi-angle WAJIB:
- Pertahankan outfit, hair, skin tone, features
- Background konsisten (neutral)
- Lighting konsisten (cinematic studio)

═══════════════════════════════════════════════════
   [C] EXPRESSION VARIATIONS (5 English Prompts)
═══════════════════════════════════════════════════
1. Neutral: [prompt ekspresi netral]
2. Happy: [prompt ekspresi senang, senyum lebar]
3. Sad: [prompt ekspresi sedih, mata turun]
4. Angry: [prompt ekspresi marah, alis berkerut]
5. Surprised: [prompt ekspresi kaget, mata melebar]

═══════════════════════════════════════════════════
   [D] POSE VARIATIONS (6 English Prompts)
═══════════════════════════════════════════════════
1. Standing: [berdiri natural, arms at sides]
2. Walking: [berjalan mid-stride, natural movement]
3. Sitting: [duduk natural di kursi]
4. Running: [berlari dinamis, motion blur]
5. Action: [pose aksi — jumping/fighting/etc]
6. Close-up: [head & shoulders, portrait style]

═══════════════════════════════════════════════════
   [E] DESIGN NOTES
═══════════════════════════════════════════════════
- Ciri khas: [yang membedakan dari karakter lain]
- Warna dominan: [palette utama]
- Aksesoris wajib: [yang harus selalu ada]
- Hindari: [yang tidak boleh muncul]
- Tips konsistensi: [cara jaga karakter di berbagai scene]
- Midjourney tip: Pakai --oref [URL] (Midjourney V7) atau --cref [URL] --cw 100 (V6) untuk konsistensi
- Stable Diffusion tip: Pakai IP-Adapter atau LoRA

═══════════════════════════════════════════════════
   [F] VOICE RECOMMENDATION (Auto-Analyzed)
═══════════════════════════════════════════════════
${o.charDetails && o.charDetails.subjectType && !/^manusia$/i.test(o.charDetails.subjectType) ? `⚠️ Subjek adalah "${o.charDetails.subjectType}" — jika tidak berbicara seperti manusia, rekomendasikan DESAIN SUARA yang sesuai (mis. growl/chirp bernada + subtitle makna untuk hewan, beep/synth processed untuk robot/AI, atau "tanpa suara, visual saja" untuk objek/kendaraan pasif) alih-alih memaksakan profil suara manusia.\n` : ''}
**Analisis Karakter:**
Berdasarkan visual "${o.charDetails ? o.charDetails.style : 'character'}" + kepribadian "${o.charDetails ? o.charDetails.personality : 'default'}", karakter ini cocok dengan:

**Voice Profile:**
- Tipe Suara: [jenis — Pria Baritone / Wanita Mezzo / dll]
- Range Nada: [Bass / Baritone / Tenor / Alto / Soprano]
- Usia Suara: [estimasi sesuai visual]
- Karakter Suara: [Hangat / Berwibawa / Ceria / Misterius]
- Aksen: [Indonesia netral / Jakarta / Sunda / dll]
- Tempo Bicara: [Lambat / Normal / Cepat]
- Emosi Default: [Netral / Ceria / Serius]

**Alasan:**
[2-3 kalimat menjelaskan kenapa voice ini cocok]

**Voice Description (English):**
[Deskripsi lengkap untuk TTS — pitch, tone, pace, texture, mood]

**Reference Voices (3 opsi):**
1. [Nama dubber/artis] — [alasan cocok]
2. [Nama dubber/artis] — [alasan cocok]
3. [Nama dubber/artis] — [alasan cocok]

**SSML Hints:**
- Pitch: [+/- semitone]
- Rate: [% kecepatan]
- Volume: [default/soft/loud]
- Pauses: [di mana harus jeda]
- Emphasis: [kata yang ditekankan]

**AI Voice Platform:**
- Utama: ElevenLabs
- Voice ID: "[nama voice]"
- Settings: stability [0-100], similarity [0-100], style [0-100]

**Do's & Don'ts:**
✅ [tips penggunaan voice]
❌ [pantangan]`,

    // ========================================
    // LOKASI (MULTI-ANGLE)
    // ========================================
    'lokasi': (o) => `TASK: Buat prompt lokasi LENGKAP dengan MULTI-ANGLE + variasi waktu.

${o.hasRef ? `Referensi: ${o.refCount} gambar` : ''}

${o.locDetails ? `DETAIL LOKASI:
Nama: ${o.locDetails.name || '-'}
Jenis: ${o.locDetails.type}
Waktu: ${o.locDetails.time}
Cuaca: ${o.locDetails.weather}
Mood: ${o.locDetails.mood}
Arsitektur / Desain: ${o.locDetails.arch}
Lighting: ${o.locDetails.light}
Gaya: ${o.locDetails.style}
Warna: ${o.locDetails.color}
Elemen penting: ${o.locDetails.elements || '-'}
Elemen alam: ${o.locDetails.nature || '-'}
Elemen buatan manusia: ${o.locDetails.manmade || '-'}
Suara / atmosfer ambient: ${o.locDetails.ambience || '-'}
Skala: ${o.locDetails.size}
⚠️ Jika "Jenis" adalah lokasi non-konvensional (luar angkasa, bawah laut, dunia mini, mimpi/surreal), sesuaikan istilah waktu & cuaca secara logis (mis. luar angkasa = "tanpa siklus siang-malam, diterangi bintang/nebula"; bawah laut = "cahaya bioluminesensi, bukan cuaca permukaan") alih-alih memaksakan jam & cuaca bumi normal.` : ''}

FORMAT OUTPUT — WAJIB 5 BAGIAN:

═══════════════════════════════════════════════════
   [A] MAIN LOCATION PROMPT (English)
═══════════════════════════════════════════════════
[Prompt lengkap: architecture/design, furniture, materials, textures, colors, natural elements, man-made elements, atmosphere]
Time: ${o.locDetails ? o.locDetails.time : 'golden hour'}
Weather: ${o.locDetails ? o.locDetails.weather : 'clear'}
Lighting: ${o.locDetails ? o.locDetails.light : 'cinematic'}
Camera: wide eye-level
Mood: ${o.locDetails ? o.locDetails.mood : 'warm'}
Style: ${o.locDetails ? o.locDetails.style : 'photorealistic'}
--ar 16:9 --style raw

═══════════════════════════════════════════════════
   [B] MULTI-ANGLE SHOTS (5 English Prompts)
═══════════════════════════════════════════════════

1. WIDE ESTABLISHING:
[Full view of location, everything visible, cinematic wide shot]

2. MEDIUM SHOT:
[Medium view, showing main area with details, 35mm lens]

3. CLOSE-UP DETAIL:
[Close-up of key detail — texture, object, or feature]

4. AERIAL/TOP-DOWN:
[Bird's eye view, showing layout & arrangement]

5. CORNER/PERSPECTIVE:
[Angled view from corner, dramatic perspective, wide angle]

Setiap angle WAJIB konsisten: same location, atmosphere & mood SAMA.

═══════════════════════════════════════════════════
   [C] TIME VARIATIONS (3 English Prompts)
═══════════════════════════════════════════════════

1. MORNING (06:00-09:00):
[Prompt lokasi di pagi hari — soft light, blue-ish tone, calm]

2. GOLDEN HOUR (17:00-18:30):
[Prompt lokasi saat golden hour — warm orange, long shadows]

3. NIGHT (20:00+):
[Prompt lokasi di malam — artificial lighting, moody, neon if applicable]

═══════════════════════════════════════════════════
   [D] MOOD VARIATIONS (3 English Prompts)
═══════════════════════════════════════════════════

1. HAPPY/BRIGHT:
[Same location, cheerful atmosphere, people, lively]

2. DARK/MYSTERIOUS:
[Same location, moody, quiet, dramatic shadows]

3. ROMANTIC/SOFT:
[Same location, warm & intimate, bokeh, gentle]

═══════════════════════════════════════════════════
   [E] SCENE DETAILS
═══════════════════════════════════════════════════

- Objek penting: [list objek khas yang harus ada]
- Elemen alam: [air, vegetasi, bebatuan, debu bintang, dll — sesuai field "Elemen alam"]
- Elemen buatan manusia: [jalan, struktur, signage, mesin — sesuai field "Elemen buatan manusia"]
- Suara / atmosfer ambient: [deskripsi audio khas lokasi — untuk referensi SFX/ambience]
- Warna dominan: [palette utama]
- Suasana: [deskripsi atmosfer]
- Elemen khas: [yang bikin lokasi unik]
- Consistency tips: [cara jaga lokasi di berbagai shot]
- Midjourney tip: Pakai --sref [URL] untuk style reference`,

    // ========================================
    // NASKAH VO
    // ========================================
    'naskah-vo': (o) => `TASK: Buat naskah Voice Over untuk ${o.platform}.

KONTEKS:
- Tone: ${o.tone}
- Durasi: ${o.durationTarget}
- Target: ${o.audienceTarget}
- Bahasa: ${o.lang}
${o.keyword ? `- Topik: ${o.keyword}` : ''}

FORMAT OUTPUT:

═══════════════════════════════════════════════════
   NASKAH VOICE OVER
═══════════════════════════════════════════════════

**Opening (3-5s) — HOOK:**
"[Hook narator]"

**Body (Bagian Utama):**
"[Isi pesan — 2-3 poin utama]"

**Closing (3-5s):**
"[CTA atau closing statement]"

═══════════════════════════════════════════════════
   PANDUAN BACAAN
═══════════════════════════════════════════════════
- Kecepatan: [X kata/menit]
- Jeda: [di mana harus jeda]
- Penekanan: [kata yang ditekankan]
- Emosi per bagian: [deskripsi]
- Tone suara: [hangat/tegas/ceria]

═══════════════════════════════════════════════════
   TIMING
═══════════════════════════════════════════════════
[00:00-00:03] "..."
[00:03-00:XX] "..."
[00:XX-akhir] "..."

═══════════════════════════════════════════════════
   VARIASI TONE
═══════════════════════════════════════════════════
1. Versi Santai   : [cara baca santai]
2. Versi Dramatis : [cara baca dramatis]
3. Versi Semangat  : [cara baca energik]`,

    // ========================================
    // SCRIPT DIALOG
    // ========================================
    'script-dialog': (o) => `TASK: Buat script dialog antar karakter.

KONTEKS:
- Tone: ${o.tone}
- Bahasa: ${o.lang}
- Platform: ${o.platform}

${rules.GLOBAL_RULES.aturanDialog}

FORMAT OUTPUT:

═══════════════════════════════════════════════════
   CHARACTER REGISTRY
═══════════════════════════════════════════════════
[CHAR_1] [Nama] — [deskripsi: usia, gender, peran]
[CHAR_2] [Nama] — [deskripsi]
[CHAR_3] [Nama] — [deskripsi]

═══════════════════════════════════════════════════
   DIALOG SCENE
═══════════════════════════════════════════════════

SCENE: [judul scene]
SETTING: [lokasi, waktu]

[00:00-00:0X] [CHAR_1] [Nama]: "[dialog]"
              [stage direction dalam tanda kurung]

[00:0X-00:0X] [CHAR_2] [Nama]: "[dialog]"
              [stage direction]

[lanjutkan scene lengkap]

═══════════════════════════════════════════════════
   VOICE MAPPING
═══════════════════════════════════════════════════
[CHAR_1] [Nama] → [tipe suara, tone, aksen]
[CHAR_2] [Nama] → [tipe suara, tone, aksen]
[CHAR_3] [Nama] → [tipe suara, tone, aksen]

═══════════════════════════════════════════════════
   CATATAN AKTING
═══════════════════════════════════════════════════
- Emosi per bagian: [deskripsi]
- Gesture penting: [list]
- Pause & timing: [catatan]`,

    // ========================================
    // MUSIK & SFX
    // ========================================
    'musik-sfx': (o) => `TASK: Deskripsikan musik & sound effect.

KONTEKS:
- Tone: ${o.tone}
- Platform: ${o.platform}

FORMAT OUTPUT:

═══════════════════════════════════════════════════
   MUSIK BACKGROUND
═══════════════════════════════════════════════════
- Genre      : [orchestral/electronic/acoustic/lo-fi/dll]
- Tempo      : [BPM]
- Instruments: [list instrumen utama]
- Mood       : [emotional/tenang/tegang/ceria]
- Reference  : [band/artis mirip]

═══════════════════════════════════════════════════
   SOUND EFFECT (SFX)
═══════════════════════════════════════════════════
- Opening   : [SFX masuk]
- Aksi utama: [SFX aksi]
- Transisi  : [SFX transisi]
- Climax    : [SFX impact]
- Closing   : [SFX penutup]

═══════════════════════════════════════════════════
   AUDIO LAYOUT (5 LAYER)
═══════════════════════════════════════════════════
${rules.GLOBAL_RULES.audioLayoutTemplate}

═══════════════════════════════════════════════════
   REFERENSI & TIPS
═══════════════════════════════════════════════════
- Musik referensi: [2-3 lagu]
- SFX referensi: [2-3 sumber]
- Mixing: [tips mixing untuk ${o.platform}]`,

    // ========================================
    // SEO & CAPTION
    // ========================================
    'seo-caption': (o) => `TASK: Optimasi SEO & caption untuk ${o.platform}.

KONTEKS:
- Tone: ${o.tone}
- Target: ${o.audienceTarget}
- Bahasa: ${o.lang}
${o.keyword ? `- Keyword utama: ${o.keyword}` : ''}

FORMAT OUTPUT:

═══════════════════════════════════════════════════
   CAPTION UTAMA
═══════════════════════════════════════════════════
[Caption 2-3 baris + emoji, bahasa ${o.lang}]

═══════════════════════════════════════════════════
   ALTERNATIF CAPTION (3 opsi)
═══════════════════════════════════════════════════
1. [Versi pendek — punchy]
2. [Versi storytelling]
3. [Versi pertanyaan]

═══════════════════════════════════════════════════
   HASHTAG (20-30 tag)
═══════════════════════════════════════════════════
🔥 Trending (5-8):
#tag1 #tag2 #tag3 #tag4

🎯 Niche (8-12):
#tag1 #tag2 #tag3

📍 Lokal (3-5):
#tag1 #tag2

═══════════════════════════════════════════════════
   SEO DESCRIPTION
═══════════════════════════════════════════════════
**Deskripsi YouTube (2-3 paragraf):**
[deskripsi lengkap untuk search engine]

**Tag YouTube (maks 500 char):**
[tag1, tag2, tag3, ...]

**Keyword Utama:** ${o.keyword || '[otomatis]'}
**Keyword Sekunder:** [3-5 alternatif]

═══════════════════════════════════════════════════
   BEST POSTING TIME
═══════════════════════════════════════════════════
- Hari   : [rekomendasi hari]
- Jam    : [jam WIB]
- Alasan : [kenapa waktu ini optimal]

═══════════════════════════════════════════════════
   TIPS BOOST ALGORITHM ${o.platform.toUpperCase()}
═══════════════════════════════════════════════════
1. [tip 1]
2. [tip 2]
3. [tip 3]

═══════════════════════════════════════════════════
   PREDIKSI PERFORMA
═══════════════════════════════════════════════════
- Potential views: [estimasi]
- Engagement rate: [estimasi %]
- Alasan: [analisis singkat]`
};

// ============================================
// BUILDER — Pilih prompt sesuai kategori
// ============================================
function buildSystemPrompt(options = {}) {
    const category = options.category || 'video-iklan';
    const tool = PROMPTS_MULTI[category] || PROMPTS_SINGLE[category] || PROMPTS_MULTI['video-iklan'];

    const styleValue = options.style || 'Cinematic, realistic, professional';

    const o = {
        // Storyboard
        adegan: Number(options.adegan) || 2,
        shot: Number(options.shotPerAdegan) || 5,
        durasi: options.durasi || '10s',
        part: Number(options.part) || 1, totalPart: Number(options.totalPart) || 1,
        lock: options.lock || '', prevTail: options.prevTail || '',
        lockChars: options.lockChars || [], lockLoc: options.lockLoc || null, extras: options.extras || {},
        variant: findVariant(category, options.variantId), brand: options.brand || null, product: options.product || null,
        durSec: 0, perShot: '0', combo: '', contentSecPerScene: '0',
        ratio: options.aspectRatio || '16:9',
        voice: options.voiceMode || 'Auto Director (Konteksual)',
        lang: options.language || 'Bahasa Indonesia',
        char: Number(options.charCount) || 3,
        hasRef: options.hasReferences || false,
        refCount: options.referenceCount || 0,
        style: styleValue,

        // Content
        platform: options.platform || 'TikTok',
        contentType: options.contentType || 'Edukasi / Tips',
        durationTarget: options.durationTarget || '30 detik',
        aspectRatio: options.aspectRatio || '9:16',
        tone: options.tone || 'Santai & Akrab',
        audienceTarget: options.audienceTarget || 'Millennials (25-40)',
        videoFormat: options.videoFormat || 'Mix (Ngobrol + B-Roll)',
        musicBg: options.musicBg || 'Auto',
        hookCount: Number(options.hookCount) || 5,
        titleCount: Number(options.titleCount) || 10,
        keyword: options.keyword || '',
        styleVisual: styleValue,

        // Animation
        animStyle: options.animStyle || 'Anime (2D)',
        fps: options.frameRate || '24 fps (Cinematic)',
        palette: options.colorPalette || 'Vibrant & Colorful',

        // Detail objects
        charDetails: options.charDetails || null,
        locDetails: options.locDetails || null
    };

    const secOf = v => { const t = String(v || ''); const n = parseFloat(t); if (!n) return 10; return /menit|min/i.test(t) ? n * 60 : n; };
    o.durSec = secOf(o.durasi);
    o.perShot = (o.durSec / o.shot).toFixed(1);
    o.combo = rules.getPanelRules(o.shot).kombinasiIdeal;
    o.contentSecPerScene = (secOf(o.durationTarget) / o.adegan).toFixed(1);

    const isMulti = !!PROMPTS_MULTI[category];
    const head = isMulti ? partBlock(o, category) + assetBlock(o) + brandBlock(o) + variantBlock(o) : '';
    // Aturan kesetiaan ditaruh paling depan agar tidak tertimpa aturan kreatif
    const fidelity = rules.GLOBAL_RULES.kesetiaanArahan + '\n\n' + (o.hasRef ? rules.GLOBAL_RULES.kesetiaanReferensi + '\n\n' : '');
    return fidelity + head + extrasBlock(o) + tool(o) + (isMulti ? '' : singleExtra(category)) + NO_PREAMBLE;
}

const CATEGORIES = [...Object.keys(PROMPTS_MULTI), ...Object.keys(PROMPTS_SINGLE)];

// Penegak aturan video berurutan di sisi server: jika model lupa, dua baris wajib ditambahkan otomatis
const SEQ_LINE = 'Single continuous full-frame video. Shots play one after another in strict sequence — no split screen, no panels.';
function postProcess(text, category) {
    if (!PROMPTS_MULTI[category] || category === 'konten-sosmed') return text;
    return String(text).replace(/(\[VIDEO PROMPT\][ \t]*\n)([\s\S]*?)(?=\n[ \t]*###\s|\n[ \t]*═{8,}|$)/g, (m, head, body) => {
        let b = body.trim();
        if (!/^Single continuous full-frame video/i.test(b)) b = SEQ_LINE + '\n' + b;
        if (!/NEGATIVE VIDEO/i.test(b)) b += '\nNEGATIVE VIDEO: ' + rules.GLOBAL_RULES.negativeVideo;
        return head + b + '\n';
    });
}

module.exports = { buildSystemPrompt, CATEGORIES, postProcess, assetBlock, brandBlock, variantBlock, extrasBlock, findVariant, clip };