const errors = {
  "节点链接格式无效": "Invalid node link format",
  "链接包含无效的编码字符": "The link contains invalid encoded characters",
  "请输入节点链接": "Enter at least one node link",
  "最多保存 200 个节点": "Use no more than 200 nodes",
  "不支持的协议": "Unsupported protocol",
  "需要有效的服务器和端口": "A valid server and port are required",
  "节点认证信息无效": "Invalid node credentials",
  "UUID 无效": "Invalid UUID",
  "仅支持 encryption=none": "Only encryption=none is supported",
  "不支持该 security": "Unsupported security mode",
  "Trojan 需要 TLS": "Trojan requires TLS",
  "Reality 缺少 pbk 公钥": "Reality requires a pbk public key",
  "不支持此 flow 组合": "Unsupported flow combination",
  "VMess 链接内容无效": "Invalid VMess link payload",
  "不支持该加密方式": "Unsupported cipher",
  "不支持该混淆方式": "Unsupported obfuscation",
  "混淆缺少密码": "Obfuscation requires a password",
  "端口跳跃格式无效": "Invalid port hopping range",
  "不支持该插件": "Unsupported plugin",
  "不支持该拥塞控制": "Unsupported congestion control",
  "不支持该 UDP 中继模式": "Unsupported UDP relay mode",
  "不支持该 XHTTP 模式": "Unsupported XHTTP mode"
};
function englishError(message) { return errors[message] || message.replace('暂不支持参数 ', 'Unsupported parameter: ').replace('暂不支持传输 ', 'Unsupported transport: '); }

export const PROTOCOLS = {vless:'VLESS', trojan:'Trojan', hysteria2:'Hysteria2', tuic:'TUIC', vmess:'VMess', ss:'Shadowsocks'};
const ALIASES = {hy2:'hysteria2'};
export const protocolOf = line => { const scheme = line.trim().split(':')[0].toLowerCase(); return ALIASES[scheme] || (scheme in PROTOCOLS ? scheme : null); };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SS_CIPHERS = ['aes-128-gcm','aes-192-gcm','aes-256-gcm','chacha20-ietf-poly1305','xchacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm','2022-blake3-aes-256-gcm','2022-blake3-chacha20-poly1305',
  'aes-128-cfb','aes-192-cfb','aes-256-cfb','aes-128-ctr','aes-192-ctr','aes-256-ctr','chacha20-ietf','rc4-md5'];
const VMESS_CIPHERS = ['auto','aes-128-gcm','chacha20-poly1305','none','zero'];
const truthy = value => ['1','true'].includes(String(value).toLowerCase());

function base64(text) {
  const clean = text.replace(/-/g,'+').replace(/_/g,'/').replace(/\s/g,'');
  try {
    const binary = atob(clean + '='.repeat((4 - clean.length % 4) % 4));
    return new TextDecoder('utf-8', {fatal:true}).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
  } catch { throw new Error('节点链接格式无效'); }
}
function endpoint(host, port, defaultPort) {
  const server = (host || '').replace(/^\[|\]$/g, '');
  const value = port === '' || port === undefined ? defaultPort : port;
  if (!server || !/^\d+$/.test(String(value)) || +value < 1 || +value > 65535) throw new Error('需要有效的服务器和端口');
  return {server, port: +value};
}
function onlyParams(q, allowed) { for (const key of q.keys()) if (!allowed.includes(key)) throw new Error(`暂不支持参数 ${key}`); }
function parseUrl(line) { try { return new URL(line); } catch { throw new Error('节点链接格式无效'); } }

function vlessOrTrojan(u, type) {
  const q = u.searchParams;
  onlyParams(q, ['type','security','encryption','flow','sni','peer','fp','pbk','sid','alpn','host','path','serviceName','allowInsecure',
    'headerType','spx','mode','authority']);
  const credential = decodeURIComponent(u.username);
  if (!credential || u.password) throw new Error('节点认证信息无效');
  if (type === 'vless' && !UUID.test(credential)) throw new Error('UUID 无效');
  if (q.has('encryption') && q.get('encryption') !== 'none') throw new Error('仅支持 encryption=none');
  const p = {type, ...endpoint(u.hostname, u.port), udp: true};
  p[type === 'vless' ? 'uuid' : 'password'] = credential;
  const security = q.get('security') || (type === 'trojan' ? 'tls' : 'none');
  if (!['tls','reality','none'].includes(security)) throw new Error('不支持该 security');
  if (type === 'trojan' && security !== 'tls') throw new Error('Trojan 需要 TLS');
  p.tls = security !== 'none';
  if (q.get('sni') || q.get('peer')) p[type === 'trojan' ? 'sni' : 'servername'] = q.get('sni') || q.get('peer');
  if (q.get('fp')) p['client-fingerprint'] = q.get('fp');
  if (q.get('alpn')) p.alpn = q.get('alpn').split(',');
  if (q.has('allowInsecure')) p['skip-cert-verify'] = truthy(q.get('allowInsecure'));
  if (security === 'reality') {
    if (!q.get('pbk')) throw new Error('Reality 缺少 pbk 公钥');
    p['reality-opts'] = {'public-key': q.get('pbk'), 'short-id': q.get('sid') || ''};
    p['client-fingerprint'] ||= 'chrome';
  }
  const network = q.get('type') || 'tcp';
  if (!['tcp','ws','grpc','xhttp'].includes(network) || (network === 'xhttp' && type !== 'vless')) throw new Error(`暂不支持传输 ${network}`);
  // Only the default header is supported; spx, gRPC mode and authority have no Mihomo equivalent and are safe to drop.
  const header = q.get('headerType') || 'none';
  if (header !== 'none') throw new Error(`暂不支持传输 ${network}/${header}`);
  if (q.get('flow')) {
    if (type !== 'vless' || network !== 'tcp' || !p.tls || q.get('flow') !== 'xtls-rprx-vision') throw new Error('不支持此 flow 组合');
    p.flow = q.get('flow');
  }
  p.network = network;
  if (network === 'ws') p['ws-opts'] = {path: q.get('path') || '/', ...(q.get('host') ? {headers: {Host: q.get('host')}} : {})};
  if (network === 'grpc') p['grpc-opts'] = {'grpc-service-name': q.get('serviceName') || ''};
  if (network === 'xhttp') {
    const mode = q.get('mode') || 'auto';
    if (!['auto','packet-up','stream-up','stream-one'].includes(mode)) throw new Error('不支持该 XHTTP 模式');
    p['xhttp-opts'] = {path: q.get('path') || '/', ...(q.get('host') ? {host: q.get('host')} : {}), ...(mode !== 'auto' ? {mode} : {})};
  }
  return p;
}

// hysteria2://auth@host:port/?sni=&insecure=1&obfs=salamander&obfs-password=&mport=20000-30000
function hysteria2(u) {
  const q = u.searchParams;
  onlyParams(q, ['sni','peer','insecure','allowInsecure','obfs','obfs-password','pinSHA256','alpn','mport','up','down']);
  const user = decodeURIComponent(u.username), pass = decodeURIComponent(u.password);
  const password = u.password ? `${user}:${pass}` : user;
  if (!password) throw new Error('节点认证信息无效');
  const p = {type:'hysteria2', ...endpoint(u.hostname, u.port, 443), password, udp: true};
  if (q.get('mport')) {
    if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(q.get('mport'))) throw new Error('端口跳跃格式无效');
    p.ports = q.get('mport');
  }
  if (q.get('sni') || q.get('peer')) p.sni = q.get('sni') || q.get('peer');
  if (q.has('insecure') || q.has('allowInsecure')) p['skip-cert-verify'] = truthy(q.get('insecure') ?? q.get('allowInsecure'));
  if (q.get('obfs')) {
    if (q.get('obfs') !== 'salamander') throw new Error('不支持该混淆方式');
    if (!q.get('obfs-password')) throw new Error('混淆缺少密码');
    p.obfs = 'salamander'; p['obfs-password'] = q.get('obfs-password');
  }
  if (q.get('pinSHA256')) p.fingerprint = q.get('pinSHA256').replace(/:/g, '').toLowerCase();
  if (q.get('alpn')) p.alpn = q.get('alpn').split(',');
  for (const key of ['up','down']) if (q.get(key)) p[key] = q.get(key);
  return p;
}

// tuic://uuid:password@host:port?congestion_control=bbr&alpn=h3&sni=&udp_relay_mode=native
function tuic(u) {
  const q = u.searchParams;
  onlyParams(q, ['sni','peer','alpn','congestion_control','udp_relay_mode','allow_insecure','allowInsecure','insecure','disable_sni']);
  const uuid = decodeURIComponent(u.username), password = decodeURIComponent(u.password);
  if (!UUID.test(uuid)) throw new Error('UUID 无效');
  if (!password) throw new Error('节点认证信息无效');
  const p = {type:'tuic', ...endpoint(u.hostname, u.port), uuid, password, udp: true};
  if (q.get('sni') || q.get('peer')) p.sni = q.get('sni') || q.get('peer');
  p.alpn = (q.get('alpn') || 'h3').split(',');
  const congestion = q.get('congestion_control');
  if (congestion) {
    if (!['cubic','new_reno','bbr'].includes(congestion)) throw new Error('不支持该拥塞控制');
    p['congestion-controller'] = congestion;
  }
  const relay = q.get('udp_relay_mode');
  if (relay) {
    if (!['native','quic'].includes(relay)) throw new Error('不支持该 UDP 中继模式');
    p['udp-relay-mode'] = relay;
  }
  const insecure = q.get('allow_insecure') ?? q.get('allowInsecure') ?? q.get('insecure');
  if (insecure !== null) p['skip-cert-verify'] = truthy(insecure);
  if (q.has('disable_sni')) p['disable-sni'] = truthy(q.get('disable_sni'));
  return p;
}

// v2rayN format: vmess://base64(JSON)
function vmess(line) {
  let data;
  try { data = JSON.parse(base64(line.slice(8).split('#')[0])); } catch { throw new Error('VMess 链接内容无效'); }
  if (!data || typeof data !== 'object') throw new Error('VMess 链接内容无效');
  const known = ['v','ps','add','port','id','aid','scy','net','type','host','path','tls','sni','alpn','fp','allowInsecure'];
  for (const key of Object.keys(data)) if (!known.includes(key)) throw new Error(`暂不支持参数 ${key}`);
  const uuid = String(data.id || '');
  if (!UUID.test(uuid)) throw new Error('UUID 无效');
  const cipher = data.scy || 'auto';
  if (!VMESS_CIPHERS.includes(cipher)) throw new Error('不支持该加密方式');
  const network = data.net || 'tcp';
  if (!['tcp','ws','grpc','h2'].includes(network)) throw new Error(`暂不支持传输 ${network}`);
  if (data.type && data.type !== 'none') throw new Error(`暂不支持传输 ${network}/${data.type}`);
  if (data.tls && !['tls','none'].includes(data.tls)) throw new Error('不支持该 security');
  const p = {type:'vmess', ...endpoint(String(data.add || ''), String(data.port ?? '')), uuid, alterId: +data.aid || 0, cipher, udp: true, tls: data.tls === 'tls', network};
  if (data.sni) p.servername = data.sni;
  if (data.alpn) p.alpn = String(data.alpn).split(',');
  if (data.fp) p['client-fingerprint'] = data.fp;
  if (data.allowInsecure !== undefined) p['skip-cert-verify'] = truthy(data.allowInsecure);
  if (network === 'ws') p['ws-opts'] = {path: data.path || '/', ...(data.host ? {headers: {Host: data.host}} : {})};
  if (network === 'grpc') p['grpc-opts'] = {'grpc-service-name': data.path || ''};
  if (network === 'h2') { p.tls = true; p['h2-opts'] = {path: data.path || '/', ...(data.host ? {host: data.host.split(',')} : {})}; }
  return {proxy: p, name: data.ps ? String(data.ps) : ''};
}

// SIP002 (ss://base64(method:pass)@host:port/?plugin=...#name), plain userinfo
// for 2022 ciphers, and the legacy ss://base64(method:pass@host:port)#name form.
function shadowsocks(line) {
  let body = line.slice(5);
  const hashAt = body.indexOf('#');
  const name = hashAt >= 0 ? decodeURIComponent(body.slice(hashAt + 1)) : '';
  if (hashAt >= 0) body = body.slice(0, hashAt);
  const queryAt = body.indexOf('?');
  const q = new URLSearchParams(queryAt >= 0 ? body.slice(queryAt + 1) : '');
  if (queryAt >= 0) body = body.slice(0, queryAt);
  body = body.replace(/\/$/, '');
  if (!body.includes('@')) body = base64(body);
  const at = body.lastIndexOf('@');
  if (at < 0) throw new Error('节点链接格式无效');
  let userinfo = decodeURIComponent(body.slice(0, at));
  if (!userinfo.includes(':')) userinfo = base64(userinfo);
  const colon = userinfo.indexOf(':');
  const cipher = userinfo.slice(0, colon).toLowerCase(), password = userinfo.slice(colon + 1);
  if (colon < 1 || !password) throw new Error('节点认证信息无效');
  if (!SS_CIPHERS.includes(cipher)) throw new Error('不支持该加密方式');
  const hostPort = body.slice(at + 1).match(/^(\[[^\]]+\]|[^:]+):(\d+)$/);
  if (!hostPort) throw new Error('需要有效的服务器和端口');
  onlyParams(q, ['plugin']);
  const p = {type:'ss', ...endpoint(hostPort[1], hostPort[2]), cipher, password, udp: true};
  if (q.get('plugin')) {
    const [plugin, ...options] = q.get('plugin').split(';');
    const opts = Object.fromEntries(options.map(item => { const i = item.indexOf('='); return i < 0 ? [item, true] : [item.slice(0, i), item.slice(i + 1)]; }));
    if (['obfs-local','simple-obfs'].includes(plugin)) {
      if (!['http','tls'].includes(opts.obfs)) throw new Error('不支持该混淆方式');
      p.plugin = 'obfs'; p['plugin-opts'] = {mode: opts.obfs, ...(opts['obfs-host'] ? {host: opts['obfs-host']} : {})};
    } else if (plugin === 'v2ray-plugin') {
      if (opts.mode && opts.mode !== 'websocket') throw new Error('不支持该插件');
      p.plugin = 'v2ray-plugin';
      p['plugin-opts'] = {mode:'websocket', ...(opts.tls ? {tls: true} : {}), ...(opts.host ? {host: opts.host} : {}), ...(opts.path ? {path: opts.path} : {})};
    } else throw new Error('不支持该插件');
  }
  return {proxy: p, name};
}

export function parseNodes(text, language = 'zh') {
  if (typeof text !== 'string' || !text.trim()) throw new Error(language === 'zh' ? '请输入节点链接' : 'Enter at least one node link');
  const lines = text.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 200) throw new Error(language === 'zh' ? '最多保存 200 个节点' : 'Use no more than 200 nodes');
  const names = new Set(['DIRECT', 'REJECT']);
  return lines.map((line, i) => {
    try {
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(line)) throw new Error('节点链接格式无效');
      const type = protocolOf(line);
      if (!type) throw new Error('不支持的协议');
      let proxy, name;
      if (type === 'vmess') ({proxy, name} = vmess(line));
      else if (type === 'ss') ({proxy, name} = shadowsocks(line));
      else {
        const u = parseUrl(line);
        proxy = type === 'hysteria2' ? hysteria2(u) : type === 'tuic' ? tuic(u) : vlessOrTrojan(u, type);
        name = decodeURIComponent(u.hash.slice(1));
      }
      // Prefix avoids collisions with ACL4SSR groups and built-in policy names.
      let label = `节点 · ${name || `${type}-${i + 1}`}`;
      const base = label; let n = 2;
      while (names.has(label)) label = `${base} (${n++})`;
      names.add(label);
      return {name: label, ...proxy};
    } catch (e) { const message = e instanceof URIError ? '链接包含无效的编码字符' : e.message; throw new Error(language === 'zh' ? `第 ${i + 1} 行：${message}` : `Line ${i + 1}: ${englishError(message)}`); }
  });
}
