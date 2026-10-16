import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {convert} from '../src/converter.js';
import {parseNodes} from '../public/nodes.js';
import {templates} from '../public/templates.js';
import {zh,en} from '../public/i18n.js';
const node = 'vless://11111111-1111-4111-8111-111111111111@example.com:443?security=tls#';
for(const template of templates) test(`${template.name}: valid groups with named and unmatched regions`,()=>{
  const ini=readFileSync(new URL('./fixtures/templates/'+template.url.split('/').at(-1),import.meta.url),'utf8');
  for(const names of [['HK Hong Kong','JP Japan','US Netflix'],['Custom node']]){
    const config=convert(names.map(name=>node+encodeURIComponent(name)).join('\n'),ini);
    const policies=new Set(['DIRECT','REJECT',...config.proxies.map(p=>p.name),...config['proxy-groups'].map(g=>g.name)]);
    assert.ok(config.rules.at(-1).startsWith('MATCH,'));
    for(const group of config['proxy-groups']){
      assert.ok(group.proxies.length>0,group.name);
      for(const policy of group.proxies)assert.ok(policies.has(policy),policy);
      if(group.type!=='select')assert.ok(group.url&&group.interval>0);
    }
    if(template.mode==='manual')assert.ok(config['proxy-groups'].every(g=>g.type==='select'));
  }
});
test('all interface strings exist in both languages',()=>assert.deepEqual(Object.keys(zh).sort(),Object.keys(en).sort()));
test('node errors can be shown in English',()=>{
  assert.throws(()=>parseNodes('invalid','zh'),/第 1 行：节点链接格式无效/);
  assert.throws(()=>parseNodes('invalid','en'),/Line 1: Invalid node link format/);
  assert.throws(()=>parseNodes('ss://example','en'),/Line 1: Only vless/);
  assert.throws(()=>parseNodes('','en'),/Enter at least/);
});
