# AGENTS.md — Aplikasi Budgeting

Ketentuan kerja untuk **semua** agent AI (Antigravity, OpenCode, Copilot, Cursor, Codex).
File ini otomatis dibaca agent. Baca sampai habis sebelum mengubah kode.

Nama app: **Avaln Kas** · Terakhir diperbarui: 2026-11-23
Status: **Batch A + B selesai, onboarding ada, Batch C (AI) belum**

---

## 1. Apa project ini

**Avaln Kas** — app budgeting **pribadi** untuk Android. Offline penuh, tanpa backend,
tanpa login, tanpa cloud sync, tanpa Play Store. Dipakai satu orang (pemilik repo) di
HP/tablet. Nama = "avaln" + "kas"; identitas teknis: slug `avaln-kas`, scheme
`avalnkas`, Android package `com.avaln.kas`.

Fitur inti: **rolling budget** — sisa budget harian terbawa ke hari berikutnya, sisa
minggu terbawa ke minggu depan, termasuk saat minus (debt mode).

Bahasa UI: **Indonesia**. Nada copy: pendek, netral, tanpa emoji.

## 2. Batasan yang tidak boleh dilanggar

1. **Offline & lokal.** Tidak ada network call untuk fungsi inti. Tidak ada auth,
   tidak ada server, tidak ada Supabase/Firebase.
2. **Uang selalu integer rupiah.** Tidak ada float, tidak ada sen/desimal. Jangan
   pakai `toFixed`, jangan simpan `REAL`.
3. **Tidak pakai `Intl`.** Format rupiah & tanggal ditulis manual (`src/lib/money.ts`,
   `src/lib/date.ts`) karena Hermes berbeda dari Node dan harus deterministik.
4. **Tanggal = string `YYYY-MM-DD` lokal.** Aritmetika tanggal di UTC. Jangan
   simpan `Date` object di state yang dipersist.
5. **Logika rollover tetap murni.** `src/logic/rollover.ts` dan
   `src/logic/weeks-planner.ts` tidak boleh mengimpor React, RN, atau SQLite.
6. **Warna/spacing/tipe hanya dari `src/theme/tokens.ts`.** Tidak ada hex baru,
   tidak ada shadow, tidak ada gradient.
7. **Web dimatikan.** `app.json` → `platforms: ["android","ios"]`. Jangan
   menghidupkan web: expo-sqlite web butuh `wa-sqlite.wasm` + header COOP/COEP,
   dan sudah terbukti gagal tanpa proxy khusus. Untuk melihat app, pakai
   emulator Android atau HP.
8. **Jangan menambah dependensi besar tanpa alasan.** Tidak ada UI kit, tidak ada
   state manager, tidak ada ORM. `npx shadcn add` dilarang (itu untuk web).
9. **Jangan mengubah `MIGRATION_1`.** Migrasi SQLite bersifat append-only; buat
   migrasi baru untuk perubahan berikutnya.
10. **AI tidak boleh menyimpan transaksi sendiri.** Output AI divalidasi dulu
    (`src/ai/parse.ts`), lalu ditampilkan sebagai draft; user menekan Simpan.
    Yang dikirim hanya kalimat yang diketik + nama kategori + tanggal hari ini.
    API key wajib di `expo-secure-store`; tanpa key app tetap jalan (parser lokal).

## 3. Urutan membaca untuk agent baru (wajib)

1. File ini (`AGENTS.md`).
2. `/home/avaln/Documents/Obsidian Vault/00-Handoff/current.md` — state terakhir.
3. `/home/avaln/Documents/Obsidian Vault/10-Projects/aplikasi-budgeting.md`.
4. `src/logic/rollover.ts` + `src/db/repo.ts`.

Kalau dua sumber berbeda, percayai **kode + test**, lalu perbarui dokumen.

## 4. Perintah

```bash
npm install                  # sekali
npx expo start --localhost   # dev server untuk HP/tablet via USB
adb reverse tcp:8081 tcp:8081

npm test                     # vitest (wajib hijau sebelum selesai)
npm run typecheck            # tsc --noEmit
npm run lint                 # expo lint
npx expo export --platform android --output-dir /tmp/opencode/export-check

```

**Definisi selesai (semua harus lolos):** `npm test` hijau, `typecheck` bersih,
`lint` bersih, `expo export` Android sukses. Jangan bilang "selesai" tanpa itu.

Dev server tanpa USB: `npx expo start --lan` (IP LAN saat ini `192.168.0.110`),
lalu scan QR dari Expo Go. Tablet memakai USB: `--localhost` + `adb reverse`.

### Emulator Android (tanpa HP)

SDK lokal `~/Android/Sdk` (±2,7 GB, tanpa sudo). AVD `avaln-kas`: Pixel 7,
**720×1600 @320dpi**, Android 15, RAM 3 GB, 4 core, Expo Go 58.0.5.

Entry menu aplikasi: **Android Emulator** (device-nya saja, tanpa membuka app
kita) → `~/.local/share/applications/android-emulator.desktop`, ikon di
`~/.local/share/icons/hicolor/scalable/apps/android-emulator.svg`.
Buka project tetap manual: `adb reverse` + deep link di bawah.

Manual:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH

emulator -avd avaln-kas -gpu swangle -feature -Vulkan -cores 4 \
  -no-audio -no-boot-anim -no-snapshot -no-snapshot-save &

adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```

- Renderer **wajib** `-gpu swangle` + `-feature -Vulkan`. `host` dan
  `swiftshader_indirect` segfault di mesin ini (gfxstream); `off` jalan tapi berat.
- ANR "is not responding" muncul karena rendering software; mitigasi: resolusi
  720×1600, animasi sistem 0, `-cores 4`, RAM 3 GB. Di dialog ANR pilih **Wait**.
- Hentikan: `adb emu kill` atau menu **"Matikan Emulator Avaln Kas"**.
- Uji UI otomatis: `uiautomator dump` (baca `text` + `content-desc`) → `input tap`
  koordinat → `screencap`. Beri jeda 1–2 detik.

### Build APK

Panduan lengkap: `BUILD.md`. Ringkasnya:

```bash
export JAVA_HOME="$HOME/.jdks/jdk-21.0.13.1+2"   # JDK 21, bukan 25
export ANDROID_HOME="$HOME/Android/Sdk"
cd android && ./gradlew assembleRelease
# hasil: android/app/build/outputs/apk/release/app-release.apk
```

- `android/` di-generate (`npx expo prebuild`) dan **tidak masuk git**.
- Keystore rilis: `~/.android/avaln-kas-release.keystore`; kredensial di
  `~/.android/avaln-kas-keystore.txt`; `android/keystore.properties` (chmod 600).
  Jangan pernah commit keystore/password.
- SDK yang dibutuhkan: platform 36, build-tools 36.0.0, NDK 27.1.12297006,
  CMake 3.22.1.
- `prebuild --clean` menghapus konfigurasi signing; ulangi langkah di BUILD.md.

## 5. Peta arsitektur

```
src/app/                 route (expo-router, folder src/app, nama kebab-case)
  _layout.tsx            Stack + SafeAreaProvider + StatusBar
  welcome.tsx            Onboarding sekali: budget mingguan + awal minggu
  index.tsx              Home: sisa hari ini, meter, sisa minggu, daftar hari ini, FAB
                         (redirect ke /welcome kalau settings.onboarded masih false)
  add.tsx                Tambah/ubah transaksi (toggle Pengeluaran/Pemasukan + MoneyPad)
  quick.tsx              Tambah cepat: satu kalimat → draft transaksi (lokal/AI)
  savings.tsx            Tabungan: saldo, target, riwayat, sisihkan/tarik/koreksi
  month.tsx              Ringkasan bulanan: total, tabungan, per kategori
  history.tsx            Riwayat: grup minggu → hari, tap baris = ubah/hapus
  week.tsx               Rincian minggu: 7 hari, jatah vs terpakai, carry, rollover
  settings.tsx           Budget, batas bawah, mulai minggu, kategori, backup, reset

src/ai/
  gemini.ts              Klien Gemini Flash (fetch, timeout 8 dtk, schema JSON)
  key.ts                 API key di expo-secure-store
  parse.ts               Validator output AI (murni, ada test)

src/logic/
  quick-add.ts           Parser lokal "kopi 18rb" (murni, ada test)
  savings.ts             Jadwal sweep bulanan (murni, ada test)
  monthly-summary.ts     Agregasi bulanan per kategori (murni, ada test)
  rollover.ts            JANTUNG: split pool → jatah harian → carry chain
  weeks.ts               Pembekuan minggu lewat ke tabel `weeks` (pakai DB)
  weeks-planner.ts       Daftar minggu yang perlu dibekukan (murni, ada test)

src/db/
  schema.ts              DATABASE_VERSION, MIGRATIONS, seed
  index.ts               getDb() singleton + migrate()
  repo.ts                Semua query, mapping snake_case → camelCase

src/ui/                  komponen presentasional (tanpa akses DB)
  screen.tsx             SafeArea + maxWidth 520 + padding responsif
  amount-text.tsx        nominal tabular, tone, signed
  meter.tsx              bar 2px
  money-pad.tsx          keypad IDR 12 tombol
  money-editor.tsx       modal edit nominal (dipakai Settings)

src/lib/
  money.ts               formatRp, formatSignedRp, digitsToAmount, normalizeNote
  date.ts                todayISO, addDays, startOfWeek, label Indonesia
  backup.ts              validator file backup JSON (murni, ada test)
  labels.ts              transactionLabel(note → kategori → placeholder)

src/features/home/use-home-data.ts   query + closePastWeeks + refresh saat fokus
src/features/savings/                hook tabungan + sweep otomatis
src/features/widget/                 widget Android (data, komponen, task handler)
src/main.tsx                         entry: expo-router + register widget (APK saja)
src/theme/tokens.ts                  satu-satunya sumber warna/spacing/tipe

```

Alias import: `@/` → `src/`. Nama file komponen: **kebab-case**.

## 6. Rumus rolling budget (jangan diubah tanpa test)

```
pool        = weeklyBudget + income + rolloverIn
dailyBase   = pool / 7, dibulatkan ke 500 (sisa pembulatan ke hari ke-7)
available   = base hari itu + carry dari hari sebelumnya
carryOut    = available − spent          (boleh negatif)
rolloverOut = clamp(pool − spentTotal, debtFloor, ∞)
```

Contoh acuan (pool 210.000 → base 30.000; pengeluaran per hari
22.000 / 45.000 / 20.000 / 40.000 / 10.000 / 50.000 / 0):

| Hari | Available | Spent | Carry keluar |
|---|---|---|---|
| Sen | 30.000 | 22.000 | +8.000 |
| Sel | 38.000 | 45.000 | −7.000 |
| Rab | 23.000 | 20.000 | +3.000 |
| Kam | 33.000 | 40.000 | −7.000 |
| Jum | 23.000 | 10.000 | +13.000 |
| Sab | 43.000 | 50.000 | −7.000 |
| Min | 23.000 | 0 | **+23.000** |

Aturan lain:

- `debtFloor` default `−weeklyBudget`. Tanpa floor = `null`.
- `rolloverOut` menjadi `rolloverIn` minggu berikutnya.
- Pemasukan menambah pool **minggu tempat transaksi itu dicatat**, bukan mengganti
  `weeklyBudget`. Sisa pemasukan ikut terbawa sebagai surplus.
- Minggu berjalan **tidak pernah** disimpan; selalu dihitung live.
- Meter: rasio `spentTotal / pool`; zona ≥75% `warn`, ≥90% `danger`.
- Angka utama memakai `ink`; minus `danger`; sisa <25% dari available `warn`.

## 7. Database

SQLite lewat `expo-sqlite`. File: `budgeting.db` (sandbox app).

Tabel: `settings` (1 baris, id=1), `categories`, `transactions`, `weeks`.
`settings.onboarded` (migrasi v3) menandai apakah layar sambutan sudah diisi.

Aturan:

- `transactions.local_date` string `YYYY-MM-DD`; `occurred_at` epoch ms.
- `transactions.kind` = `'expense' | 'income'` (sejak migrasi v2).
- Semua agregat belanja **wajib** `WHERE kind = 'expense'`.
- Setiap perubahan transaksi memanggil `invalidateWeeksFrom(tanggal)`.
  Perubahan Settings memanggil `clearWeeks()`. Tanpa ini rollover jadi basi.
- `weeks.budget` menyimpan **budget dasar + pemasukan** minggu itu.
- Migrasi: `MIGRATIONS[i]` dijalankan sekali sesuai `PRAGMA user_version`.
  Tambah migrasi baru = naikkan `DATABASE_VERSION` + push SQL ke array.
- Seed hanya untuk instalasi baru (4 kategori + settings 30.000/210.000).
- `settings.theme_mode` (migrasi v5) = preferensi tampilan (`system|light|dark`).
- Tabungan (migrasi v6): `settings.savings_enabled`, `settings.last_sweep_period`,
  dan `transactions.is_savings`. Setoran = `expense` + `is_savings=1` (mengurangi
  jatah), penarikan = `income` + `is_savings=1` (menambah jatah). Saldo =
  Σ setoran − Σ penarikan. Sweep otomatis sekali per bulan: tanggal eksekusi =
  awal minggu pertama setelah tanggal 1, transfer diberi tanggal H-1 dari awal
  minggu itu supaya minggu baru mulai bersih. Sisa minus tidak pernah disapu.
- Migrasi v7: `settings.savings_offset` (koreksi saldo, **tidak** mengubah jatah
  mingguan) dan `settings.savings_target`. Saldo = offset + Σ setoran − Σ tarik.
- `settings.started_on` (migrasi v4) = tanggal app mulai dipakai. Minggu sebelum
  tanggal ini **tidak** diberi budget/rollover, supaya transaksi yang di-backdate
  ke minggu lalu tidak tiba-tiba memberi surplus. Migrasi v4 juga menghapus cache
  `weeks` lama.
- `completeOnboarding()` mengisi weekly budget, `dailyTarget` (base), `weekStart`,
  `debtFloor = −weekly`, lalu `onboarded = true`.
- Migrasi v3 menandai `onboarded = 1` untuk database lama yang sudah punya transaksi;
  instalasi baru tetap 0 supaya layar sambutan muncul.

## 8. Gaya UI (Minimalism, paper light + charcoal dark)

Tema: `src/theme/theme.tsx` → `ThemeProvider` + `useTheme()` + `makeThemedStyles()`.
Mode disimpan di `settings.theme_mode` (`system|light|dark`). **Jangan impor `color`
statis**; styles dibuat per palet:

```tsx
const useStyles = makeThemedStyles((c: Palette) => StyleSheet.create({ ... }));
// di komponen: const styles = useStyles(); const { colors } = useTheme();
```

Token (`src/theme/tokens.ts`):

```
bg #FAFAF8 · surface #FFFFFF · sunken #F2F1ED
ink #12100E · ink2 #6B6862 · ink3 #A8A49C · hairline #E8E6E1
accent #1F6F5C · warn #B4761A · danger #A33A32
space 4/8/12/16/24/32/48 · radius 12/999 · meter 2px · touch 44
```

- Tanpa shadow, gradient, border tebal, emoji, atau ikon dekoratif.
- Pemisah = hairline. Fokus utama = angka besar (48pt, 40pt di layar <380dp).
- Tabular nums untuk semua nominal supaya tidak bergeser.
- Konten dibatasi `maxWidth 520` dan ditengahkan (tablet tidak melar).
- Teks panjang dipotong (`numberOfLines`), bukan dikecilkan tanpa batas.
- Minimal target sentuh 44×44. `accessibilityRole` wajib untuk tombol.

## 9. Gaya kode

- TypeScript `strict`. Tidak ada `any` baru; tidak ada `@ts-ignore`.
- Fungsi DB selalu `async` dan mengembalikan tipe eksplisit.
- Mapping DB: kolom `snake_case` → objek `camelCase` (lihat `repo.ts`).
- Komponen: function component, `StyleSheet.create` di bawah file.
- Komentar Bahasa Indonesia, singkat, jelaskan **kenapa**, bukan apa.
- Jangan menambah komentar TODO tanpa tanggal/nama batch.
- Format uang lewat `AmountText`/`formatRp`; jangan `toLocaleString`.
- **Commit selalu atas nama pemilik repo**: `Avalntinus <azaryaenka@gmail.com>`
  (sudah di-set di config lokal). Jangan mengubah `git config user.*`.
- **Dilarang menambahkan atribusi AI** di pesan commit/PR: `Co-authored-by:`,
  `Assisted-by:`, `Generated with ...` yang menyebut Claude/ChatGPT/Copilot/
  Gemini/Codex/Cursor/OpenCode/Antigravity. Hook `commit-msg` membuangnya otomatis;
  pasang ulang dengan `bash scripts/install-git-hooks.sh`.

## 10. Jebakan yang sudah memakan waktu

- **JDK 25 terlalu baru** untuk Gradle/AGP. Build APK butuh JDK 21
  (`npx expo prebuild` + EAS, belum dilakukan).
- `expo start` error 500 di root = percobaan bundel **web** (wasm). Jangan
  hidupkan web.
- Expo Go 58.0.5 dipasang manual via `adb`. Bukan dari Play Store.
- Tablet owner juga dipakai sebagai second display (UScreen) — bisa mencuri
  fokus/tap. **Jangan screenshot atau tap device tanpa izin pemilik.**
- `npx expo export` butuh ±1–2 menit; jangan anggap hang.
- 21st.dev hanya referensi visual (web/shadcn). Kuota retrieval 2/hari.
- **Expo Go punya bubble "Tools"** di pojok kanan atas yang menutupi tombol
  Setelan/Simpan (di app ini). Tap di situ membuka dev menu — bukan bug app.
  Geser bubble-nya menjauh sebelum uji tap, atau pakai build APK (tanpa bubble).
- Pertama kali buka project di Expo Go: muncul dev menu → tap **Continue**, lalu
  **BACK** untuk masuk ke app.
- Dialog **`"Emulator" Is Not Responding`** adalah GNOME (host), bukan ANR Android:
  `org.gnome.mutter check-alive-timeout` di mesin ini sempat 5 detik. Sudah di-set 0
  (`gsettings set org.gnome.mutter check-alive-timeout 0`). Kalau muncul lagi,
  pilih **Wait**, jangan Force Quit. Host 15 GB mudah penuh (emulator ±2,6 GB).
- Emulator headless + `-gpu off` lambat merender; beri jeda 1–2 detik setelah tap.
- **Widget (react-native-android-widget):** komponen widget WAJIB diawali
  `'use no memo';` (React Compiler) dan **tidak boleh memakai Fragment**
  (`<>...</>`) — pakai `FlexWidget`. Registrasi handler harus **sinkron**
  (`require` di `src/main.tsx`, bukan dynamic import) agar tidak kalah balapan
  dengan event Android. Deteksi Expo Go lewat modul native `AndroidWidget`
  (`features/widget/support.ts`), bukan `Constants.executionEnvironment`
  (SDK 58 mengembalikan `bare`). Tambah widget lewat Setelan → Tampilan
  (`requestPinWidget`).
- Setelah menambah **route baru** atau mengubah file yang di-cache, Fast Refresh
  kadang tetap menyajikan bundle lama. Reload penuh: force-stop Expo Go lalu buka
  ulang deep link (atau dev menu → Reload).

## 11. Status & backlog

Selesai: nama **Avaln Kas** + identitas teknis, scaffold, tokens, money/date, rollover,
DB v7 (`kind`, `onboarded`, `started_on`, `theme_mode`, tabungan + offset/target),
layar sambutan, Home, Tambah, Riwayat, Rincian minggu, Tambah cepat (lokal + AI),
**tabungan** (sweep, target, koreksi saldo), **ringkasan bulanan**, **dark mode**,
**widget Android**, Settings, kategori CRUD, backup JSON, tutup minggu otomatis.
**81 test hijau** (rollover, perencana minggu, parser tambah cepat, jadwal sweep,
ringkasan bulanan, tanggal, validator backup & AI).
Sudah diuji native di emulator: onboarding → pengeluaran → pemasukan → riwayat →
rincian minggu → tambah cepat (lokal) → AI menolak key palsu dengan pesan benar.

Berikutnya, berurutan:

1. **Aktifkan AI:** pemilik memasukkan API key Gemini di Setelan (belum diisi).
   Kode, validasi, dan fallback sudah ada; tanpa key tetap lokal.
2. APK rilis sudah jadi (lihat `BUILD.md`); naikkan `versionCode` untuk update.

Jangan mulai fitur baru di luar daftar ini tanpa bertanya ke pemilik.

## 12. Vault Obsidian (memori bersama)

Vault: `/home/avaln/Documents/Obsidian Vault`

- Handoff terakhir: `00-Handoff/current.md`
- Project: `10-Projects/aplikasi-budgeting.md`
- Log harian: `20-Logs/YYYY-MM-DD.md`
- Template: `90-Templates/{handoff,log,project}.md`

Aturan: untuk kerja non-trivial, baca handoff + log + note project **sebelum**
mulai, lalu sebelum selesai timpa `current.md` (≤60 baris) dan **append** 2–5
baris ke log hari itu. Jangan menulis rahasia/API key di vault. Satu penulis
pada satu waktu.

## 13. Brief siap tempel untuk agent berikutnya

> Lanjutkan project di `/home/avaln/Documents/Project Aplikasi Budgeting`.
> Baca `AGENTS.md` di root, lalu `00-Handoff/current.md` di vault Obsidian.
> Jangan ubah `src/logic/rollover.ts` tanpa menjalankan `npm test`.
> Sebelum selesai: `npm test`, `npm run typecheck`, `npm run lint`,
> `npx expo export --platform android --output-dir /tmp/opencode/export-check`,
> lalu perbarui handoff + log di vault.
