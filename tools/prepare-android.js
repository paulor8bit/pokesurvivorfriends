/* Explicit public-file bundle; never copy the checkout or saves into the APK. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, '.runtime/android-www');
fs.mkdirSync(dest, { recursive: true });
for (const name of ['index.html', 'css', 'assets', 'favicon.ico', 'version.json', 'manifest.webmanifest', 'LICENSE', 'LICENSE-NONCOMMERCIAL.md', 'CREDITS.md']) {
  fs.cpSync(path.join(root, name), path.join(dest, name), { recursive: true });
}
fs.mkdirSync(path.join(dest, 'js'), { recursive: true });
fs.copyFileSync(path.join(root, 'js/app.min.js'), path.join(dest, 'js/app.min.js'));
// The Android server supplies a minimal SW so the browser never caches room metadata.
fs.writeFileSync(path.join(dest, 'sw.js'), "self.addEventListener('install',()=>self.skipWaiting());\n");
fs.copyFileSync(path.join(root, 'android/THIRD-PARTY.md'), path.join(dest, 'ANDROID-LICENSES.md'));
for (const file of ['LICENSE-cloudflared', 'LICENSE-nanohttpd']) {
  fs.copyFileSync(path.join(root, 'android', file), path.join(dest, file + '.txt'));
}
fs.mkdirSync(path.join(root, 'android/app/src/main/res/drawable'), { recursive: true });
fs.copyFileSync(path.join(root, 'assets/icons/icon-192.png'), path.join(root, 'android/app/src/main/res/drawable/icon.png'));
console.log('Recursos Android preparados.');
