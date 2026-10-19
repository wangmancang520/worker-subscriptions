import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {convert} from '../src/converter.js';
import {STEAM_WEB_TEMPLATE,STEAM_WEB_GROUP} from '../src/custom-templates.js';
const ini=readFileSync(new URL('./fixtures/templates/ACL4SSR_Online_Full_NoAuto.ini',import.meta.url),'utf8');
const nodes='vless://11111111-1111-4111-8111-111111111111@example.com:443?security=tls#HK';
const base=convert(nodes,ini);
const custom=convert(nodes,ini,STEAM_WEB_TEMPLATE);
const prefix=custom.rules.slice(0,custom.rules.length-base.rules.length);
function policy(host){return prefix.find(rule=>{
  const [type,value]=rule.split(',');
  return type==='DOMAIN'?host===value:type==='DOMAIN-SUFFIX'&&(host===value||host.endsWith('.'+value));
})?.split(',').at(-1);}
test('Steam web exceptions precede login and download direct rules',()=>{
  for(const host of ['store.steampowered.com','checkout.steampowered.com','steamcommunity.com','community.steam-api.com','images.steamusercontent.com','store.fastly.steamstatic.com','shared.cdn.queniuqe.com'])assert.equal(policy(host),STEAM_WEB_GROUP,host);
  for(const host of ['login.steampowered.com','api.steampowered.com','cm1-hkg1.cm.steampowered.com','cache1-tyo1.steamcontent.com','steampipe.akamaized.net','client-update.queniuqe.com','store.steamchina.com','steamcloud.steamusercontent.com'])assert.equal(policy(host),'DIRECT',host);
  for(const host of ['store.steampowered.com.evil.test','example.com','epicgames.com','unrelated.akamaized.net'])assert.equal(policy(host),undefined,host);
});
test('only one group added; upstream policies retained; SteamCN pinned direct',()=>{
  assert.deepEqual(custom.rules.slice(prefix.length),base.rules);
  assert.deepEqual(custom['proxy-groups'].slice(0,-1),base['proxy-groups']);
  assert.deepEqual(custom['rule-providers'],base['rule-providers']);
  assert.equal(custom['proxy-groups'].at(-1).name,STEAM_WEB_GROUP);
  assert.equal(custom['proxy-groups'].at(-1).proxies[0],'🚀 节点选择');
  const cn=Object.entries(custom['rule-providers']).find(([,p])=>p.url.endsWith('/SteamCN.list'))[0];
  assert.ok(prefix.includes(`RULE-SET,${cn},DIRECT`));
  assert.deepEqual(convert(nodes,ini,'full-noauto'),base);
});
