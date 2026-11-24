# Build APK (Android)

Panduan lokal untuk menghasilkan APK rilis bertanda tangan sendiri.
Tidak butuh Android Studio dan tidak butuh sudo.

## Yang dibutuhkan

| Komponen    | Lokasi / versi                             |
| ----------- | ------------------------------------------ |
| Node        | ≥ 22                                       |
| JDK 21      | `~/.jdks/` (Temurin 21) — **bukan** JDK 25 |
| Android SDK | `~/Android/Sdk`                            |
| Platform    | `platforms;android-36`                     |
| Build tools | `build-tools;36.0.0`                       |
| NDK         | `ndk;27.1.12297006`                        |
| CMake       | `cmake;3.22.1`                             |
| Keystore    | `~/.android/avaln-kas-release.keystore`    |

Kredensial keystore disimpan di `~/.android/avaln-kas-keystore.txt` (chmod 600).
**Jangan pernah commit keystore atau password-nya.** Tanpa keystore yang sama,
APK baru tidak bisa menimpa instalasi lama (harus uninstall dulu).

## Menyiapkan native project

`android/` tidak masuk git (di-generate). Kalau belum ada:

```bash
npx expo prebuild --platform android --no-install
```

Setelah prebuild, jalankan skrip yang mengembalikan konfigurasi rilis
(signing dari keystore sendiri, APK per arsitektur, resource shrinking):

```bash
python3 scripts/patch-android-release.py
```

Password dibaca dari `~/.android/avaln-kas-keystore.txt`; bisa juga lewat env
`AVALN_KEYSTORE_PASSWORD`. Skrip menulis `android/keystore.properties` (chmod 600),
menambah `signingConfigs.release`, dan `splits { abi { ... } }` untuk
`arm64-v8a` + `x86_64`. Jangan commit `keystore.properties` maupun keystore.

## Build

```bash
export JAVA_HOME="$HOME/.jdks/$(ls ~/.jdks | head -1)"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

cd android
./gradlew assembleRelease
```

Hasil (satu APK per arsitektur, karena `universalApk false`):

```
android/app/build/outputs/apk/release/app-arm64-v8a-release.apk   # HP/tablet, ±34 MB
android/app/build/outputs/apk/release/app-x86_64-release.apk      # emulator, ±35 MB
```

APK universal lama (±102 MB) memuat empat arsitektur sekaligus; split membuat
unduhan tiga kali lebih kecil dan pemasangan tidak menyimpan kode CPU yang
tidak dipakai. Rilis GitHub wajib menyertakan **kedua** file: updater memilih
`x86_64` di emulator dan `arm64` di perangkat nyata.

Cek tanda tangan sebelum mengunggah (wajib cocok dengan rilis sebelumnya, kalau
tidak update akan ditolak dengan `INSTALL_FAILED_UPDATE_INCOMPATIBLE`):

```bash
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs \
  app/build/outputs/apk/release/app-arm64-v8a-release.apk | grep 'certificate SHA-256'
```

## Pasang ke HP/emulator

```bash
adb install -r android/app/build/outputs/apk/release/app-x86_64-release.apk   # emulator x86_64
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
