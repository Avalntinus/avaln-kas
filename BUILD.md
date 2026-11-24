# Build APK (Android)

Panduan lokal untuk menghasilkan APK rilis bertanda tangan sendiri.
Tidak butuh Android Studio dan tidak butuh sudo.

## Yang dibutuhkan

| Komponen | Lokasi / versi |
|---|---|
| Node | ≥ 22 |
| JDK 21 | `~/.jdks/` (Temurin 21) — **bukan** JDK 25 |
| Android SDK | `~/Android/Sdk` |
| Platform | `platforms;android-36` |
| Build tools | `build-tools;36.0.0` |
| NDK | `ndk;27.1.12297006` |
| CMake | `cmake;3.22.1` |
| Keystore | `~/.android/avaln-kas-release.keystore` |

Kredensial keystore disimpan di `~/.android/avaln-kas-keystore.txt` (chmod 600).
**Jangan pernah commit keystore atau password-nya.** Tanpa keystore yang sama,
APK baru tidak bisa menimpa instalasi lama (harus uninstall dulu).

## Menyiapkan native project

`android/` tidak masuk git (di-generate). Kalau belum ada:

```bash
npx expo prebuild --platform android --no-install
```

Setelah prebuild, signing release harus diarahkan ke keystore sendiri:

1. Buat `android/keystore.properties`:

```
storeFile=~/.android/avaln-kas-release.keystore
storePassword=...
keyAlias=avaln-kas
keyPassword=...
```

2. Di `android/app/build.gradle`:
   - muat `keystore.properties` di atas blok `android { ... }`
   - tambah `signingConfigs.release` yang membaca properti itu
   - ganti `signingConfig signingConfigs.debug` pada `buildTypes.release`
     menjadi `signingConfig signingConfigs.release`

(Konfigurasi ini sudah diterapkan di mesin ini; lihat riwayat sesi.)

## Build

```bash
export JAVA_HOME="$HOME/.jdks/$(ls ~/.jdks | head -1)"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

cd android
./gradlew assembleRelease
```

Hasil:

```
android/app/build/outputs/apk/release/app-release.apk
```

## Pasang ke HP/emulator

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Atau kirim APK ke HP dan buka manual (izinkan “install unknown apps”).

## Catatan

- Build pertama mengunduh Gradle + dependency (±10–20 menit). Berikutnya cepat.
- `npx expo prebuild --clean` akan menghapus `android/` termasuk konfigurasi
  signing — ulangi langkah signing di atas.
- API key AI tersimpan per-instalasi (`expo-secure-store`). Setelah memasang APK,
  key harus dimasukkan lagi lewat Setelan.
- Versi APK mengikuti `app.json` (`version`, `android.versionCode`). Naikkan
  `versionCode` setiap merilis update.
