import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

export async function prepareDatabase(config, run) {
  const db = config.d1_databases?.find(item => item.binding === 'DB');
  if (!db) throw new Error('Missing D1 binding DB');
  if (db.database_id && db.database_id !== '00000000-0000-0000-0000-000000000000' && db.database_id !== 'REPLACE_WITH_D1_DATABASE_ID') return config;
  if (!db.database_name) throw new Error('Missing database_name for DB');
  const find = async () => {
    const databases = JSON.parse(await run(['d1', 'list', '--json'], true));
    if (!Array.isArray(databases)) throw new Error('Unexpected D1 list response');
    const matches = databases.filter(item => item.name === db.database_name);
    if (matches.length > 1) throw new Error('Multiple databases match DB; set database_id explicitly');
    return matches[0];
  };
  let existing = await find();
  if (!existing) {
    await run(['d1', 'create', db.database_name]);
    existing = await find();
  }
  if (!existing?.uuid || !/^[0-9a-f-]{36}$/i.test(existing.uuid)) throw new Error('Cannot resolve D1 UUID after provisioning');
  return {...config, d1_databases:config.d1_databases.map(item => item === db ? {...db, database_id:existing.uuid} : item)};
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const require = createRequire(import.meta.url);
  const wranglerPackage = require.resolve('wrangler/package.json');
  const meta = JSON.parse(readFileSync(wranglerPackage,'utf8'));
  const cli = path.resolve(path.dirname(wranglerPackage), typeof meta.bin === 'string' ? meta.bin : meta.bin.wrangler);
  const run = (args, capture = false) => {
    const result = spawnSync(process.execPath, [cli,...args], {
      cwd:root, encoding:'utf8', shell:false,
      stdio:capture ? ['ignore','pipe','inherit'] : ['ignore','inherit','inherit'],
      env:{...process.env, CI:'true'}
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Wrangler ${args.slice(0,2).join(' ')} failed; deployment stopped`);
    return result.stdout;
  };
  const configPath = path.join(root,'wrangler.jsonc');
  // This project keeps wrangler.jsonc in strict JSON format.
  const config = JSON.parse(readFileSync(configPath,'utf8'));
  const resolved = await prepareDatabase(config,run);
  if (resolved !== config) writeFileSync(configPath,JSON.stringify(resolved,null,2)+'\n');
  run(['d1','migrations','apply','DB','--remote']);
  run(['deploy']);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}

