import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseNodes,convert} from '../src/converter.js';
const uuid = '11111111-1111-4111-8111-111111111111';
const b64 = (text, url = false) => Buffer.from(text).toString(url ? 'base64url' : 'base64');

test('Hysteria2 with obfs, port hopping, pin and hy2 alias', () => {
  const [p] = parseNodes('hysteria2://pa%40ss@example.com:443/?sni=sni.example.com&insecure=1&obfs=salamander&obfs-password=secret&mport=20000-30000&pinSHA256=AB:CD&alpn=h3#日本');
  assert.deepEqual(p, {name:'节点 · 日本', type:'hysteria2', server:'example.com', port:443, password:'pa@ss', udp:true, ports:'20000-30000',
    sni:'sni.example.com', 'skip-cert-verify':true, obfs:'salamander', 'obfs-password':'secret', fingerprint:'abcd', alpn:['h3']});
  const [alias] = parseNodes('hy2://user:pass@[2001:db8::1]');
  assert.equal(alias.type, 'hysteria2'); assert.equal(alias.port, 443); assert.equal(alias.password, 'user:pass'); assert.equal(alias.server, '2001:db8::1');
  assert.throws(() => parseNodes('hysteria2://pass@example.com:443?obfs=salamander'), /混淆缺少密码/);
  assert.throws(() => parseNodes('hysteria2://pass@example.com:443?obfs=gfw&obfs-password=x'), /不支持该混淆方式/);
  assert.throws(() => parseNodes('hysteria2://example.com:443'), /认证信息/);
  assert.throws(() => parseNodes('hysteria2://pass@example.com:443?mport=abc'), /端口跳跃/);
});

test('TUIC v5', () => {
  const [p] = parseNodes(`tuic://${uuid}:pw@example.com:8443?congestion_control=bbr&udp_relay_mode=quic&sni=example.com&alpn=h3&allow_insecure=0#T`);
  assert.deepEqual(p, {name:'节点 · T', type:'tuic', server:'example.com', port:8443, uuid, password:'pw', udp:true, sni:'example.com',
    alpn:['h3'], 'congestion-controller':'bbr', 'udp-relay-mode':'quic', 'skip-cert-verify':false});
  assert.throws(() => parseNodes(`tuic://${uuid}@example.com:443`), /认证信息/);
  assert.throws(() => parseNodes(`tuic://${uuid}:pw@example.com:443?congestion_control=reno`), /拥塞控制/);
});

test('VMess v2rayN JSON with ws, grpc and h2', () => {
  const link = data => 'vmess://' + b64(JSON.stringify({v:'2', ps:'香港', add:'example.com', port:'443', id:uuid, aid:'0', scy:'auto', net:'ws', type:'none', host:'cdn.example.com', path:'/ws', tls:'tls', sni:'sni.example.com', ...data}));
  const [ws] = parseNodes(link({}));
  assert.equal(ws.name, '节点 · 香港'); assert.equal(ws.type, 'vmess'); assert.equal(ws.port, 443); assert.equal(ws.alterId, 0);
  assert.equal(ws.tls, true); assert.equal(ws.servername, 'sni.example.com'); assert.deepEqual(ws['ws-opts'], {path:'/ws', headers:{Host:'cdn.example.com'}});
  assert.equal(parseNodes(link({net:'grpc', path:'svc'}))[0]['grpc-opts']['grpc-service-name'], 'svc');
  assert.deepEqual(parseNodes(link({net:'h2', tls:''}))[0]['h2-opts'], {path:'/ws', host:['cdn.example.com']});
  assert.throws(() => parseNodes(link({net:'tcp', type:'http'})), /暂不支持传输/);
  assert.throws(() => parseNodes(link({id:'bad'})), /UUID/);
  assert.throws(() => parseNodes('vmess://not-json'), /VMess/);
});

test('Shadowsocks SIP002, plain 2022 userinfo, legacy form and plugins', () => {
  const [sip] = parseNodes(`ss://${b64('aes-256-gcm:pa:ss', true)}@example.com:8388/?plugin=${encodeURIComponent('obfs-local;obfs=http;obfs-host=www.bing.com')}#US`);
  assert.deepEqual(sip, {name:'节点 · US', type:'ss', server:'example.com', port:8388, cipher:'aes-256-gcm', password:'pa:ss', udp:true,
    plugin:'obfs', 'plugin-opts':{mode:'http', host:'www.bing.com'}});
  const [plain] = parseNodes(`ss://2022-blake3-aes-128-gcm:${encodeURIComponent('a2V5/Zm9v+YmFy==')}@[::1]:443#P`);
  assert.equal(plain.cipher, '2022-blake3-aes-128-gcm'); assert.equal(plain.password, 'a2V5/Zm9v+YmFy=='); assert.equal(plain.server, '::1');
  const [legacy] = parseNodes(`ss://${b64('chacha20-ietf-poly1305:pw@1.2.3.4:443')}#L`);
  assert.equal(legacy.server, '1.2.3.4'); assert.equal(legacy.cipher, 'chacha20-ietf-poly1305');
  const [v2] = parseNodes(`ss://${b64('aes-128-gcm:pw')}@example.com:443?plugin=${encodeURIComponent('v2ray-plugin;tls;host=cdn.example.com;path=/ws')}`);
  assert.deepEqual(v2['plugin-opts'], {mode:'websocket', tls:true, host:'cdn.example.com', path:'/ws'});
  assert.equal(v2.name, '节点 · ss-1');
  assert.throws(() => parseNodes(`ss://${b64('bogus-cipher:pw')}@example.com:443`), /加密方式/);
  assert.throws(() => parseNodes(`ss://${b64('aes-128-gcm:pw')}@example.com:443?plugin=kcptun`), /插件/);
  assert.throws(() => parseNodes(`ss://${b64('aes-128-gcm:pw')}@example.com`), /服务器和端口/);
});

test('mixed protocols convert with an official template', () => {
  const template = readFileSync(new URL('./fixtures/ACL4SSR_Online.ini', import.meta.url), 'utf8');
  const nodes = [
    `vless://${uuid}@example.com:443?security=tls#HK`,
    'hysteria2://pw@example.com:443#HK',
    `tuic://${uuid}:pw@example.com:443#JP`,
    `ss://${b64('aes-128-gcm:pw', true)}@example.com:8388#US`,
    'vmess://' + b64(JSON.stringify({ps:'SG', add:'example.com', port:443, id:uuid, net:'tcp'}))
  ].join('\n');
  const config = convert(nodes, template);
  assert.deepEqual(config.proxies.map(p => p.type), ['vless','hysteria2','tuic','ss','vmess']);
  assert.equal(new Set(config.proxies.map(p => p.name)).size, 5);
  assert.ok(config['proxy-groups'][0].proxies.includes('节点 · SG'));
});

test('VLESS Reality share links with headerType, spx and gRPC extras', () => {
  const [p] = parseNodes(`vless://${uuid}@example.com:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=example.com&fp=chrome&pbk=KEY&sid=ab&spx=%2F&type=tcp&headerType=none#R`);
  assert.deepEqual(p, {name:'节点 · R', type:'vless', server:'example.com', port:443, uuid, udp:true, tls:true, servername:'example.com',
    'client-fingerprint':'chrome', 'reality-opts':{'public-key':'KEY', 'short-id':'ab'}, flow:'xtls-rprx-vision', network:'tcp'});
  const [g] = parseNodes(`vless://${uuid}@example.com:443?security=tls&type=grpc&serviceName=svc&mode=multi&authority=example.com#G`);
  assert.deepEqual(g['grpc-opts'], {'grpc-service-name':'svc'});
  assert.throws(() => parseNodes(`vless://${uuid}@example.com:443?type=tcp&headerType=http`), /暂不支持传输 tcp\/http/);
});
