/**
 * Одноразовий інтерактивний логін: номер, код із Telegram, пароль 2FA →
 * рядок сесії у файл з правами 0600. У термінал рядок не друкується ніколи
 * (research/tg-mining/01-SETUP.md: вміст сесії не виводиться).
 *
 *   TG_API_ID=… TG_API_HASH=… node login.ts <шлях-до-файла>
 *
 * Далі вміст файла стає значенням TG_SESSION у .env на сервері, а сам файл
 * видаляється.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { createClient } from './telegram.ts';

const target = process.argv[2];
const { TG_API_ID, TG_API_HASH } = process.env;

if (!target || !TG_API_ID || !TG_API_HASH) {
  process.stderr.write('usage: TG_API_ID=… TG_API_HASH=… node login.ts <session-file>\n');
  process.exit(2);
}
if (existsSync(target)) {
  process.stderr.write(`refusing to overwrite ${target}\n`);
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const client = createClient(Number(TG_API_ID), TG_API_HASH, '');

await client.start({
  phoneNumber: () => rl.question('Phone number (+48…): '),
  phoneCode: () => rl.question('Code from Telegram: '),
  password: () => rl.question('2FA password (empty if none): '),
  onError: (err) => {
    process.stderr.write(`login error: ${err.name}\n`);
  },
});
rl.close();

const session = String(client.session.save());
writeFileSync(target, session, { mode: 0o600 });
await client.destroy();
process.stdout.write(`session written to ${target} (${session.length} chars); move it into TG_SESSION and delete the file\n`);
