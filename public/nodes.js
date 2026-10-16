const errors = {
  "节点链接格式无效": "Invalid node link format",
  "链接包含无效的编码字符": "The link contains invalid encoded characters",
  "请输入节点链接": "Enter at least one node link",
  "最多保存 200 个节点": "Use no more than 200 nodes",
  "仅支持 vless:// 和 trojan://": "Only vless:// and trojan:// are supported",
  "需要有效的服务器和端口": "A valid server and port are required",
  "节点认证信息无效": "Invalid node credentials",
  "VLESS UUID 无效": "Invalid VLESS UUID",
  "仅支持 encryption=none": "Only encryption=none is supported",
  "不支持该 security": "Unsupported security mode",
  "Trojan 需要 TLS": "Trojan requires TLS",
  "Reality 缺少 pbk 公钥": "Reality requires a pbk public key",
  "不支持此 flow 组合": "Unsupported flow combination"
};
function englishError(message) { return errors[message] || message.replace('暂不支持参数 ', 'Unsupported parameter: ').replace('暂不支持传输 ', 'Unsupported transport: '); }

export function parseNodes(text, language = 'zh') {
  if (typeof text !== 'string' || !text.trim()) throw new Error(language === 'zh' ? '请输入节点链接' : 'Enter at least one node link');
  const lines = text.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 200) throw new Error(language === 'zh' ? '最多保存 200 个节点' : 'Use no more than 200 nodes');
  const names = new Set(['DIRECT', 'REJECT']);
  return lines.map((line, i) => {
    try {
      let u;
      try { u = new URL(line); } catch { throw new Error('节点链接格式无效'); }
      const q = u.searchParams;
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
    } catch (e) { const message = e instanceof URIError ? '链接包含无效的编码字符' : e.message; throw new Error(language === 'zh' ? `第 ${i + 1} 行：${message}` : `Line ${i + 1}: ${englishError(message)}`); }
  });
}

