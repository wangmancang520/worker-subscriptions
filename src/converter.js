export const TEMPLATE_URL = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini';

export function parseNodes(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('请输入节点链接');
  const lines = text.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 200) throw new Error('最多保存 200 个节点');
  const names = new Set(['DIRECT', 'REJECT']);
  return lines.map((line, i) => {
    try {
      const u = new URL(line), q = u.searchParams;
      const type = u.protocol.slice(0, -1);
      if (!['vless', 'trojan'].includes(type)) throw new Error('仅支持 vless:// 和 trojan://');
      const allowed = new Set(['type','security','encryption','flow','sni','peer','fp','pbk','sid','alpn','host','path','serviceName','allowInsecure']);
      for (const key of q.keys()) if (!allowed.has(key)) throw new Error(`暂不支持参数 ${key}`);
      if (!u.hostname || !u.port || +u.port < 1 || +u.port > 65535) throw new Error('需要有效的服务器和端口');
      const credential = decodeURIComponent(u.username);
      if (!credential || u.password) throw new Error('节点认证信息无效');
      if (type === 'vless' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(credential)) throw new Error('VLESS UUID 无效');
      if (q.has('encryption') && q.get('encryption') !== 'none') throw new Error('仅支持 encryption=none');
      let label = decodeURIComponent(u.hash.slice(1)) || `${type}-${i + 1}`;
      // Prefix avoids collisions with ACL4SSR groups and built-in policy names.
      label = `节点 · ${label}`;
      const base = label; let n = 2;
      while (names.has(label)) label = `${base} (${n++})`;
      names.add(label);
      const p = {name: label, type, server: u.hostname.replace(/^\[|\]$/g, ''), port: +u.port, udp: true};
      p[type === 'vless' ? 'uuid' : 'password'] = credential;
      const security = q.get('security') || (type === 'trojan' ? 'tls' : 'none');
      if (!['tls','reality','none'].includes(security)) throw new Error('不支持该 security');
      if (type === 'trojan' && security !== 'tls') throw new Error('Trojan 需要 TLS');
      p.tls = security !== 'none';
      if (q.get('sni') || q.get('peer')) p[type === 'trojan' ? 'sni' : 'servername'] = q.get('sni') || q.get('peer');
      if (q.get('fp')) p['client-fingerprint'] = q.get('fp');
      if (q.get('alpn')) p.alpn = q.get('alpn').split(',');
      if (q.has('allowInsecure')) p['skip-cert-verify'] = ['1','true'].includes(q.get('allowInsecure'));
      if (security === 'reality') {
        if (!q.get('pbk')) throw new Error('Reality 缺少 pbk 公钥');
        p['reality-opts'] = {'public-key': q.get('pbk'), 'short-id': q.get('sid') || ''};
        p['client-fingerprint'] ||= 'chrome';
      }
      const network = q.get('type') || 'tcp';
      if (!['tcp','ws','grpc'].includes(network)) throw new Error(`暂不支持传输 ${network}`);
      if (q.get('flow')) {
        if (type !== 'vless' || network !== 'tcp' || !p.tls || q.get('flow') !== 'xtls-rprx-vision') throw new Error('不支持此 flow 组合');
        p.flow = q.get('flow');
      }
      p.network = network;
      if (network === 'ws') p['ws-opts'] = {path: q.get('path') || '/', ...(q.get('host') ? {headers: {Host: q.get('host')}} : {})};
      if (network === 'grpc') p['grpc-opts'] = {'grpc-service-name': q.get('serviceName') || ''};
      return p;
    } catch (e) { throw new Error(`第 ${i + 1} 行：${e.message}`); }
  });
}

export function convert(nodes, template) {
  const proxies = parseNodes(nodes), groups = [], rules = [], providers = {};
  for (const raw of template.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('custom_proxy_group=')) {
      const [name, type, ...parts] = line.slice(19).split('`');
      if (!['select','url-test'].includes(type)) throw new Error('模板包含不支持的分组');
      const group = {name, type, proxies: []};
      for (const part of parts) {
        if (part.startsWith('[]')) group.proxies.push(part.slice(2));
        else if (/^https?:/.test(part)) group.url = part;
        else if (/^\d+,,\d+$/.test(part)) { const [interval,, tolerance] = part.split(','); group.interval = +interval; group.tolerance = +tolerance; }
        else { const re = new RegExp(part); group.proxies.push(...proxies.filter(p => re.test(p.name)).map(p => p.name)); }
      }
      group.proxies = [...new Set(group.proxies)]; groups.push(group);
    } else if (line.startsWith('ruleset=')) {
      const value = line.slice(8), comma = value.indexOf(','), group = value.slice(0, comma), source = value.slice(comma + 1);
      if (source.startsWith('[]')) {
        const rule = source.slice(2);
        rules.push(rule === 'FINAL' ? `MATCH,${group}` : `${rule},${group}`);
      } else {
        if (!source.startsWith('https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/')) throw new Error('模板规则来源无效');
        const key = `acl-${Object.keys(providers).length + 1}`;
        providers[key] = {type:'http', behavior:'classical', format:'text', url:source, path:`./ruleset/${key}.list`, interval:86400};
        rules.push(`RULE-SET,${key},${group}`);
      }
    }
  }
  if (!groups.length || !rules.length || !rules.at(-1).startsWith('MATCH,')) throw new Error('ACL4SSR 模板不完整');
  const policies = new Set(['DIRECT','REJECT', ...proxies.map(p => p.name), ...groups.map(g => g.name)]);
  for (const g of groups) for (const p of g.proxies) if (!policies.has(p)) throw new Error('模板引用未知分组');
  return {'mixed-port':7890, 'allow-lan':false, mode:'rule', 'log-level':'info', ipv6:true, proxies, 'proxy-groups':groups, 'rule-providers':providers, rules};
}
