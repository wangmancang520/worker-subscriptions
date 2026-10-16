import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDatabase} from '../scripts/deploy.js';
const uuid = '12345678-1234-1234-1234-123456789abc';
const config = id => ({d1_databases:[{binding:'DB',database_name:'subscriptions',...(id ? {database_id:id} : {})}]});
test('preserves configured databases without creating replacements',async () => {
  const c = config(uuid);
  assert.equal(await prepareDatabase(c,() => {throw Error('must not run');}),c);
});
test('resolves missing and legacy placeholder IDs to an existing database',async () => {
  for (const id of [undefined,'00000000-0000-0000-0000-000000000000','REPLACE_WITH_D1_DATABASE_ID']) {
    const calls=[];
    const c=await prepareDatabase(config(id),args => {calls.push(args);return JSON.stringify([{name:'subscriptions',uuid}]);});
    assert.equal(c.d1_databases[0].database_id,uuid);
    assert.deepEqual(calls,[['d1','list','--json']]);
  }
});
test('creates missing database and resolves its actual UUID',async () => {
  const calls=[];
  const c=await prepareDatabase(config(),args => {calls.push(args);return args[1]==='list' ? JSON.stringify(calls.length===1 ? [] : [{name:'subscriptions',uuid}]) : '';});
  assert.equal(c.d1_databases[0].database_id,uuid);
  assert.deepEqual(calls,[['d1','list','--json'],['d1','create','subscriptions'],['d1','list','--json']]);
});
test('permission failures stop provisioning rather than creating another database',async () => {
  const calls=[];
  await assert.rejects(prepareDatabase(config(),args => {calls.push(args);throw Error('Forbidden');}),/Forbidden/);
  assert.equal(calls.length,1);
});

