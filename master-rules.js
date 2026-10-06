// ============================================
// MASTER ATURAN PROMPT GAMBAR & VIDEO v4.0
// + SCENE CONSISTENCY LOCK + VIDEO BERURUTAN
// ============================================

const GLOBAL_RULES = {
    aturanGlobal: `ATURAN GLOBAL:
A. FORMAT & UKURAN (HANYA UNTUK [IMAGE PROMPT])
   1. FULL BLEED edge-to-edge
   2. NO outer border / frame / margin
   3. Panel dipisah garis putih tipis
   4. Setiap panel ada nomor "1", "2", ... "[N]" di kiri atas
   5. Tidak ada teks lain di gambar
   6. DILARANG KERAS memberikan kalimat pembuka/penutup (seperti "Berikut hasilnya..." atau "Semoga membantu").
   7. LANGSUNG output sesuai format yang diminta. TANPA BASA-BASI.

B. SINKRONISASI (HANYA UNTUK [IMAGE PROMPT] — video memakai aturan berurutan)
   1. Semua panel gambar = MOMEN YANG SAMA
   2. Karakter TIDAK PINDAH POSISI antar panel
   3. Pose, background, lokasi konsisten
   4. Yang berubah hanya sudut & jarak kamera

C. KOMBINASI SHOT
   1. MAKSIMAL 1 WIDE SHOT per gambar
   2. Tipe: WIDE (WD), MEDIUM (MD), CLOSE UP (CU)`,

    sceneLockRule: `═══════════════════════════════════════════════════
   🔒 SCENE CONSISTENCY LOCK — WAJIB, TANPA PENGECUALIAN
═══════════════════════════════════════════════════

ATURAN MUTLAK: SEMUA ADEGAN HARUS BERADA DI LOKASI YANG SAMA PERSIS.
Background TIDAK BOLEH berubah antar adegan, kecuali user eksplisit minta ganti.

LANGKAH WAJIB #1 — TENTUKAN MASTER SCENE DI AWAL OUTPUT:

Sebelum menulis "### ADEGAN 1", WAJIB tulis blok berikut:

### MASTER SCENE
LOKASI       : [nama lokasi + deskripsi 1 kalimat]
ARSITEKTUR   : [gaya arsitektur & material utama]
PALET WARNA  : [3-5 warna dominan, sebutkan hex/nama]
LIGHTING     : [jenis cahaya + arah + intensitas]
WAKTU        : [jam/waktu hari]
PROPS KUNCI  : [3-5 objek yang HARUS muncul di setiap panel]
ATMOSFER     : [mood/suasana 1 kalimat]

LANGKAH WAJIB #2 — SEMUA ADEGAN (1 s/d N) WAJIB:

✅ Background = SAMA PERSIS dengan MASTER SCENE
✅ Props kunci = MUNCUL di setiap panel (minimal 2 dari list)
✅ Palet warna = IDENTIK (tidak boleh tambah warna baru)
✅ Lighting = KONSISTEN (arah cahaya sama)
✅ Waktu = SAMA (jangan ganti siang→malam)
✅ Yang BOLEH berubah: hanya SUDUT KAMERA, JARAK, AKSI KARAKTER

LANGKAH WAJIB #3 — DILARANG KERAS:

❌ Ganti lokasi di tengah cerita
❌ Ganti waktu (pagi→siang→malam) tanpa instruksi user
❌ Ganti palet warna dominan
❌ Ganti jenis arsitektur
❌ Hilangkan props kunci di salah satu adegan
❌ Ganti jenis lighting
❌ Background blur yang menyembunyikan lokasi

LANGKAH WAJIB #4 — VALIDASI DIRI SEBELUM OUTPUT:

✓ Apakah semua ### ADEGAN pakai LOKASI yang sama?
✓ Apakah ARSITEKTUR konsisten?
✓ Apakah PALET WARNA identik?
✓ Apakah LIGHTING arah & jenisnya sama?
✓ Apakah PROPS KUNCI muncul di setiap adegan?
✓ Apakah WAKTU tidak berubah?

Jika ada satu saja yang TIDAK → perbaiki SEBELUM output.
Jika user minta "ganti lokasi di adegan X" → BARU boleh berubah, dan hanya di adegan itu.`,

    negativePromptBaku: `no outer border, no frame, no margin,
no text other than panel numbers, no labels, no captions, no watermark, no signature,
no additional characters, no character movement between panels,
no character repositioning, no two wide shots,
no inconsistent character design, no changing outfit,
no changing hair, no changing skin tone, no changing eyes,
no different face between panels, no mismatched features,
no over-saturated colors, no muddy colors,
no blurry, no low quality, no pixelated, no jpeg artifacts,
no distorted proportions, no extra limbs, no extra fingers,
no floating objects, no disconnected shadows,
no inconsistent lighting, no mismatched light direction,
no cluttered composition, no random objects,
no background change between panels, no different location per panel,
no color palette shift, no time of day change,
no different architecture style, no missing key props`,

    // ATURAN VIDEO BARU: shot berjalan berurutan, tidak ada panel jalan bersamaan
    videoSequentialRule: `═══════════════════════════════════════════════════
   🎞️ ATURAN VIDEO — SHOT BERJALAN BERURUTAN (WAJIB)
═══════════════════════════════════════════════════
[IMAGE PROMPT] = lembar storyboard (semua panel dalam SATU gambar).
[VIDEO PROMPT] = SATU video kontinu satu frame penuh. Panel/grid TIDAK ADA di video.

1. Video = satu frame penuh; hanya SATU shot aktif pada satu waktu.
2. Shot berjalan BERURUTAN: shot N mulai tepat saat shot N-1 selesai. Timestamp DILARANG tumpang tindih.
3. DILARANG: split-screen, grid/kolase panel, picture-in-picture, nomor panel, garis pemisah putih, atau beberapa shot bergerak bersamaan.
4. Pergantian shot = hard cut / transisi singkat. Tidak ada dua gerakan kamera berbeda di waktu yang sama.
5. Setiap baris SHOT hanya mendeskripsikan apa yang terlihat di shot itu; aksi karakter bersambung natural dari shot sebelumnya (posisi, pakaian, props konsisten).
6. Dialog, narasi, dan SFX mengikuti jam shot yang sedang aktif — jangan memasukkan suara shot lain.
7. Kalimat PERTAMA isi [VIDEO PROMPT] wajib: "Single continuous full-frame video. Shots play one after another in strict sequence — no split screen, no panels."
8. Baris TERAKHIR [VIDEO PROMPT] wajib: "NEGATIVE VIDEO: ..." berisi daftar negative video.`,

    negativeVideo: `no split screen, no grid layout, no collage, no multi-panel frame, no picture-in-picture,
no panel numbers, no white divider lines, no simultaneous shots, no overlapping scenes,
no shots playing at the same time, no outer border, no watermark,
no sudden change of character, outfit, or background, no flicker, no morphing faces,
no extra characters, no distorted hands, no jump in lighting`,

    // Scene lock khusus TIMELAPSE: waktu/cahaya BOLEH berubah progresif
    sceneLockTimelapse: `═══════════════════════════════════════════════════
   🔒 SCENE LOCK — VERSI TIMELAPSE
═══════════════════════════════════════════════════
TETAP SAMA di semua adegan & shot: lokasi, posisi/sudut kamera (tripod terkunci), framing, arsitektur, props kunci, palet dasar.
BOLEH BERUBAH hanya sesuai baris "TIME PROGRESSION" di MASTER SCENE: jam/cahaya, cuaca, langit, progres objek, keramaian.
Perubahan harus BERTAHAP dan MENAIK (tidak melompat mundur).

Sebelum "### ADEGAN 1" WAJIB tulis:
### MASTER SCENE
LOKASI / ARSITEKTUR / PALET WARNA (dasar) / LIGHTING (awal → akhir) / WAKTU (awal → akhir) / PROPS KUNCI / ATMOSFER
TIME PROGRESSION : [tahap/jam tiap adegan & shot, dari awal sampai akhir]`,

    aturanDialog: `═══════════════════════════════════════════════════
   ATURAN DIALOG — SANGAT KETAT (WAJIB DIIKUTI)
═══════════════════════════════════════════════════

1. CHARACTER REGISTRY (WAJIB DIBUAT SEBELUM DIALOG)
   Setiap karakter yang bicara HARUS didaftarkan dengan ID unik:

   CHARACTER REGISTRY:
   ───────────────────────────────
   [CHAR_1] NamaKarakter — deskripsi singkat (usia, gender, peran)
   [CHAR_2] NamaKarakter — deskripsi singkat
   [CHAR_3] NamaKarakter — deskripsi singkat

2. FORMAT DIALOG (WAJIB):
   [timestamp] [CHAR_ID] NamaKarakter: "dialog"

   Contoh BENAR:
   [00:00-00:03] [CHAR_1] Rian: "Selamat pagi!"
   [00:03-00:06] [CHAR_2] Sarah: "Kopi susu satu ya, Mas."

   Contoh SALAH (DILARANG):
   ❌ "Selamat pagi!" (tanpa karakter)
   ❌ Rian: "Kopi susu satu ya" (nama ketuker)
   ❌ [CHAR_1]: "..." (tanpa nama)

3. ATURAN KERAS:
   ✅ Setiap dialog WAJIB ada [CHAR_ID] + NamaKarakter
   ✅ Karakter yang bicara HARUS ada di CHARACTER REGISTRY
   ✅ Urutan dialog HARUS sesuai timeline shot
   ✅ 1 baris dialog = 1 karakter (tidak boleh digabung)
   ✅ Karakter A tidak boleh bicara dialog karakter B
   ✅ Karakter diam = JANGAN tampilkan di timeline dialog
   ✅ Jika tidak ada dialog, tulis: [No dialog]
   ❌ DILARANG dialog tanpa atribusi karakter
   ❌ DILARANG 2 karakter bicara di timestamp sama
   ❌ DILARANG karakter bicara di shot yang bukan miliknya

4. VOICE MAPPING (WAJIB)
   Setiap karakter punya voice descriptor KONSISTEN:

   VOICE MAPPING:
   ───────────────────────────────
   [CHAR_1] Rian  → Baritone, Hangat, 24-28 thn, Jakarta accent
   [CHAR_2] Sarah → Soprano, Ceria, 20-25 thn, Indonesia netral
   [CHAR_3] Boss  → Bass, Berwibawa, 40-50 thn, Sunda accent

5. VALIDASI DIRI (SEBELUM OUTPUT):
   ✓ Setiap dialog punya [CHAR_ID]?
   ✓ Nama karakter cocok dengan registry?
   ✓ Karakter yang bicara memang ada di scene?
   ✓ Urutan dialog sesuai timeline?
   ✓ Voice mapping konsisten antar shot?`,

    audioLayoutTemplate: `[FI]  [0.00-0.30]  Fade in semua layer
[AMB] [0.00-10.0]  [Ambience] (loop) [%]
[SFX] SHOT 1 [x.x-x.x]  [SFX]
[SFX] SHOT 2 [x.x-x.x]  [SFX]
[SFX] SHOT 3 [x.x-x.x]  [SFX]
[DRN] [x.x-x.x]    [Drone] → [XFD]
[FO]  [9.70-10.00] Fade out semua layer`
};

const PANEL_RULES = {
    1: { kombinasiIdeal: 'MD saja (1 shot penuh, tanpa WD + CU)', timeline: '1 shot sepanjang durasi' },
    2: { kombinasiIdeal: 'WD + CU', timeline: '5.0s + 5.0s' },
    3: { kombinasiIdeal: 'WD + MD + CU', timeline: '3.5s + 3.5s + 3.0s' },
    4: { kombinasiIdeal: 'WD + MD + MD + CU', timeline: '2.5s × 4' },
    5: { kombinasiIdeal: 'WD + MD + MD + MD + CU', timeline: '2.0s × 5' },
    6: { kombinasiIdeal: 'WD + MD + MD + MD + CU + CU', timeline: '1.7s × 6' }
};

const KAMUS_SHOT = {
    WD: 'WIDE SHOT — Seluruh ruangan, semua karakter terlihat. MAKSIMAL 1 PER GAMBAR',
    MD: 'MEDIUM SHOT — Setengah badan, 1-2 karakter dalam frame',
    CU: 'CLOSE UP — Muka + bahu, 1 karakter, emosi paling jelas'
};

function getPanelRules(panelCount) {
    const n = Math.min(Math.max(Number(panelCount) || 3, 1), 6);
    return PANEL_RULES[n];
}

function getTimeline(panelCount) {
    return getPanelRules(panelCount).timeline;
}

module.exports = { GLOBAL_RULES, PANEL_RULES, KAMUS_SHOT, getPanelRules, getTimeline };
