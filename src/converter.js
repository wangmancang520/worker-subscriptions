import {parseNodes} from '../public/nodes.js';
export {parseNodes};
export const TEMPLATE_URL = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini';

export function convert(nodes, template) {
  const proxies = parseNodes(nodes), groups = [], rules = [], providers = {};
  for (const raw of template.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('custom_proxy_group=')) {
      const [name, type, ...parts] = line.slice(19).split('`');
      if (!['select','url-test','fallback','load-balance'].includes(type)) throw new Error('模板包含不支持的分组');
      const group = {name, type, proxies: []};
      for (const part of parts) {
        if (part.startsWith('[]')) group.proxies.push(part.slice(2));
        else if (/^https?:/.test(part)) group.url = part;
        else if (/^\d+(,,\d+)?$/.test(part)) { const [interval,, tolerance] = part.split(','); group.interval = +interval; if (tolerance) group.tolerance = +tolerance; }
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
  // Region/Netflix regex groups without matching nodes cannot be emitted empty.
  const removed = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of groups) {
      group.proxies = group.proxies.filter(name => !removed.has(name));
      if (!group.proxies.length && !removed.has(group.name)) { removed.add(group.name); changed = true; }
    }
  }
  const activeGroups = groups.filter(g => !removed.has(g.name));
  const policies = new Set(['DIRECT','REJECT', ...proxies.map(p => p.name), ...activeGroups.map(g => g.name)]);
  for (const g of activeGroups) for (const p of g.proxies) if (!policies.has(p)) throw new Error('模板引用未知分组');
  for (const rule of rules) if (!policies.has(rule.split(',').at(-1))) throw new Error('模板规则引用未知分组');
  return {'mixed-port':7890, 'allow-lan':false, mode:'rule', 'log-level':'info', ipv6:true, proxies, 'proxy-groups':activeGroups, 'rule-providers':providers, rules};
}
