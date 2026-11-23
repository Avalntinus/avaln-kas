# GEMINI.md — pointer

Ketentuan lengkap ada di **`AGENTS.md`** (root repo). Baca file itu dulu.

Kalau belum terbaca, ini aturan kerasnya:

1. Offline, tanpa backend/login/cloud. Jangan tambah network call untuk fungsi inti.
2. Uang = integer rupiah. Tanpa float, tanpa `Intl`, tanpa `toFixed`.
3. Tanggal = string `YYYY-MM-DD` lokal. Aritmetika UTC.
4. `src/logic/rollover.ts` & `weeks-planner.ts` tetap murni (tanpa React/DB).
5. Warna/spacing/tipe hanya dari `src/theme/tokens.ts`.
6. Jangan ubah `MIGRATION_1`; tambah migrasi baru + naikkan `DATABASE_VERSION`.
7. Sebelum bilang selesai: `npm test` (47 hijau), `npm run typecheck`,
   `npm run lint`, `npx expo export --platform android`.
8. Handoff & log: `/home/avaln/Documents/Obsidian Vault/00-Handoff/current.md`
   dan `20-Logs/YYYY-MM-DD.md`.
