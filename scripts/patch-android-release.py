#!/usr/bin/env python3
"""Tempel ulang konfigurasi rilis ke folder android/ hasil `expo prebuild`.

`npx expo prebuild --clean` menghapus signing, sedangkan gradle.properties dan
build.gradle di-regenerate. Skrip ini mengembalikan tiga hal yang dibutuhkan APK
rilis tanpa menambah dependensi:

1. signing config dari `~/.android/avaln-kas-keystore.txt` -> android/keystore.properties
2. APK per arsitektur (arm64-v8a, x86_64) supaya ukuran unduhan tidak 2x lipat
3. resource shrinking selain R8 yang sudah aktif dari template

Jalankan setelah prebuild, sebelum `./gradlew assembleRelease`.
"""

import os
import pathlib
import re
import stat
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ANDROID = ROOT / "android"
GRADLE = ANDROID / "app" / "build.gradle"
GRADLE_PROPS = ANDROID / "gradle.properties"
KEYSTORE_PROPS = ANDROID / "keystore.properties"
KEYSTORE_INFO = pathlib.Path.home() / ".android" / "avaln-kas-keystore.txt"

ARCHES = ["arm64-v8a", "x86_64"]

SIGNING_PROPS_BLOCK = """
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}"""

RELEASE_SIGNING = """        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
"""

SPLITS_BLOCK = """    splits {
        abi {
            enable true
            reset()
            include %s
            universalApk false
        }
    }
""" % ", ".join(f"'{arch}'" for arch in ARCHES)


def fail(message: str) -> None:
    print(f"gagal: {message}", file=sys.stderr)
    raise SystemExit(1)


def write_keystore_props() -> None:
    if not (ANDROID / "app" / "build.gradle").exists():
        fail("folder android/ belum ada, jalankan `npx expo prebuild -p android` dulu")

    password = os.environ.get("AVALN_KEYSTORE_PASSWORD")
    if not password and KEYSTORE_INFO.exists():
        match = re.search(r"^Password\s*:\s*(.+)$", KEYSTORE_INFO.read_text(), re.MULTILINE)
        password = match.group(1).strip() if match else None

    if not password:
        fail("password keystore tidak ditemukan (set AVALN_KEYSTORE_PASSWORD)")

    store_file = pathlib.Path.home() / ".android" / "avaln-kas-release.keystore"
    if not store_file.exists():
        fail(f"keystore tidak ada: {store_file}")

    KEYSTORE_PROPS.write_text(
        "storeFile={}\nstorePassword={}\nkeyAlias=avaln-kas\nkeyPassword={}\n".format(
            store_file, password, password
        )
    )
    KEYSTORE_PROPS.chmod(stat.S_IRUSR | stat.S_IWUSR)


def patch_gradle() -> None:
    source = GRADLE.read_text()

    if "keystorePropertiesFile" not in source:
        source = source.replace(
            "def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()",
            "def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n"
            + SIGNING_PROPS_BLOCK,
            1,
        )

    if "signingConfigs.release" not in source.replace("signingConfig signingConfigs.release", ""):
        source = source.replace(
            "            keyPassword 'android'\n        }\n    }",
            "            keyPassword 'android'\n        }\n" + RELEASE_SIGNING + "    }",
            1,
        )

    source = source.replace(
        "signingConfig signingConfigs.debug", "signingConfig signingConfigs.release", 1
    )

    if "splits {" not in source:
        source = source.replace("    defaultConfig {\n", SPLITS_BLOCK + "\n    defaultConfig {\n", 1)

    GRADLE.write_text(source)


def patch_gradle_props() -> None:
    source = GRADLE_PROPS.read_text()
    if "android.enableShrinkResourcesInReleaseBuilds" not in source:
        source = source.rstrip("\n") + "\nandroid.enableShrinkResourcesInReleaseBuilds=true\n"
    if "android.enableMinifyInReleaseBuilds=true" not in source:
        source = source.rstrip("\n") + "\nandroid.enableMinifyInReleaseBuilds=true\n"
    GRADLE_PROPS.write_text(source)


def main() -> None:
    write_keystore_props()
    patch_gradle()
    patch_gradle_props()
    print("rilis siap: signing, APK per arsitektur ({}), shrink resource".format(", ".join(ARCHES)))


if __name__ == "__main__":
    main()
