const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dest = path.resolve(__dirname, '../.runtime/android-native/arm64-v8a/libcloudflared.so');
const originalHash = 'b7e55b4d9702c2ab5f8348f780bb1db044527fc555367714c78e0595750a4665';
const patchedHash = '2c1e1b6631524b18571449644c8a12c739d5a473ec23a02b993d1b10f888504f';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  if (fs.existsSync(dest) && hash(fs.readFileSync(dest)) === patchedHash) return;
  const r = await fetch('https://github.com/cloudflare/cloudflared/releases/download/2026.10.2/cloudflared-linux-arm64');
  if (!r.ok) throw Error('Não foi possível baixar o túnel Android.');
  const b = Buffer.from(await r.arrayBuffer());
  if (hash(b) !== originalHash) throw Error('Hash inválido no túnel Android.');
  const from = Buffer.from('/etc/resolv.conf'), to = Buffer.from('//proc/self/fd/0');
  let count = 0;
  for (let i = 0; (i = b.indexOf(from, i)) >= 0; i += from.length) { to.copy(b, i); count++; }
  if (count !== 1 || hash(b) !== patchedHash) throw Error('Adaptação DNS inesperada.');
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, b);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
