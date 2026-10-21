/** Local setup only. Never print or replace encryption key material. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const target = path.resolve(__dirname, '../.env.local');
const previous = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
if (process.env.KAIPAI_CREDENTIAL_KEYS || /^KAIPAI_CREDENTIAL_KEYS=/m.test(previous)) {
  console.log('凭证加密配置已存在，未改动。');
} else {
  const active = 'local1';
  const value = JSON.stringify({ active, keys: { [active]: crypto.randomBytes(32).toString('base64') } });
  fs.writeFileSync(target, `${previous}${previous.endsWith('\n') || !previous ? '' : '\n'}KAIPAI_CREDENTIAL_KEYS='${value}'\n`, { mode: 0o600 });
  fs.chmodSync(target, 0o600);
  console.log('已创建本地凭证加密配置。请备份 .env.local；重启服务后生效。');
}
