const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DARK = '#0A0A0A';

/**
 * `expo-splash-screen` hanya menulis `splashscreen_background` untuk mode malam,
 * sedangkan `android:windowBackground` memakai `activityBackground` yang tetap
 * terang. Akibatnya celah transisi dan cold start di mode gelap berkedip putih.
 * Plugin ini menambahkan `activityBackground` versi gelap.
 */
module.exports = function withDarkWindowBackground(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/values-night');
      fs.mkdirSync(dir, { recursive: true });

      const file = path.join(dir, 'colors.xml');
      let xml = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '<resources>\n</resources>\n';
      const entry = `<color name="activityBackground">${DARK}</color>`;

      if (/name="activityBackground"/.test(xml)) {
        xml = xml.replace(/<color name="activityBackground">[^<]*<\/color>/, entry);
      } else {
        xml = xml.replace('</resources>', `  ${entry}\n</resources>`);
      }

      fs.writeFileSync(file, xml);
      return cfg;
    },
  ]);
};
