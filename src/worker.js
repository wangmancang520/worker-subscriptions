import {convert, parseNodes} from './converter.js';
import {templateById} from '../public/templates.js';
const secureHeaders = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{...secureHeaders, 'Content-Type':'application/json; charset=utf-8'}});
const validSecret = s => /^[A-Za-z0-9_-]{16,128}$/.test(s);
async function hash(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2,'0')).join(''); }
const templateCache = new Map();
async function template(id = 'online') {
  const selected = templateById(id);
  if (!selected) throw new Error('未知模板');
  const cachedTemplate = templateCache.get(id);
  if (cachedTemplate && Date.now() - cachedTemplate.time < 3600000) return cachedTemplate.text;
  const response = await fetch(selected.url, {signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('无法获取 ACL4SSR 模板，请稍后重试');
  const text = await response.text();
  if (text.length > 100000 || !text.includes('custom_proxy_group=')) throw new Error('ACL4SSR 模板异常');
  templateCache.set(id,{time:Date.now(), text}); return text;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), parts = url.pathname.split('/').filter(Boolean);
    try {
      if (parts[0] === 'api' && parts[1] === 'profiles' && parts.length === 3) {
        const secret = parts[2];
        if (!validSecret(secret)) return json({error:'暗号需为 16–128 位字母、数字、下划线或短横线'},400);
        const id = await hash(secret);
        if (request.method === 'GET') {
          const row = await env.DB.prepare('SELECT nodes, template, revision, updated_at FROM profiles WHERE id = ?').bind(id).first();
          return row ? json(row) : json({error:'未找到此暗号，可在此页面创建'},404);
        }
        if (request.method !== 'PUT') return json({error:'不支持的方法'},405);
        if (request.headers.get('Origin') !== url.origin) return json({error:'仅允许同源保存'},403);
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'需要 JSON'},415);
        const reader = request.body?.getReader(); let size = 0; const chunks = [];
        if (!reader) return json({error:'缺少内容'},400);
        while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 131072) { await reader.cancel(); return json({error:'节点内容超过 128 KiB'},413); } chunks.push(value); }
        const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) {bytes.set(c,offset); offset += c.length;}
        let data; try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch {return json({error:'无效 JSON'},400);}
        if (!data || !Number.isInteger(data.revision) || data.revision < 0) return json({error:'版本无效，请重新打开页面'},400);
        try { parseNodes(data.nodes); } catch(e) {return json({error:e.message},400);}
        // Older clients omit template: preserve the saved choice on update.
        const previous = data.template === undefined && data.revision > 0 ? await env.DB.prepare('SELECT template FROM profiles WHERE id = ?').bind(id).first() : null;
        const selectedTemplate = data.template ?? previous?.template ?? 'online';
        if (!templateById(selectedTemplate)) return json({error:'未知模板'},400);
        const now = new Date().toISOString();
        const result = data.revision === 0
          ? await env.DB.prepare('INSERT INTO profiles (id,nodes,template,revision,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(id,data.nodes,selectedTemplate,now).run()
          : await env.DB.prepare('UPDATE profiles SET nodes = ?, template = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(data.nodes,selectedTemplate,now,id,data.revision).run();
        if (!result.meta.changes) return json({error:'此页面已在其他地方更新，请重新打开后再编辑'},409);
        return json({revision:data.revision + 1, updated_at:now});
      }
      if (parts.length === 2 && parts[1] === 'sub') {
        if (!['GET','HEAD'].includes(request.method)) return json({error:'不支持的方法'},405);
        if (!validSecret(parts[0])) return json({error:'订阅不存在'},404);
        const row = await env.DB.prepare('SELECT nodes, template FROM profiles WHERE id = ?').bind(await hash(parts[0])).first();
        if (!row) return json({error:'订阅不存在'},404);
        let config; try {config = convert(row.nodes, await template(row.template), row.template);} catch {return json({error:'配置生成失败，请检查节点或稍后重试 ACL4SSR 模板'},502);}
        // JSON is valid YAML 1.2 and accepted by Mihomo's YAML configuration loader.
        return new Response(request.method === 'HEAD' ? null : JSON.stringify(config,null,2),{headers:{...secureHeaders,'Content-Type':'text/yaml; charset=utf-8','Content-Disposition':'attachment; filename="subscription.yaml"','profile-update-interval':'6'}});
      }
      if (!['GET','HEAD'].includes(request.method)) return json({error:'不支持的方法'},405);
      const asset = ['/app.js','/style.css','/favicon.svg','/nodes.js','/templates.js','/i18n.js'].includes(url.pathname);
      if (!asset && url.pathname !== '/' && !(parts.length === 1 && validSecret(parts[0]))) return json({error:'页面不存在'},404);
      const target = new URL(asset ? url.pathname : '/index.html',url.origin);
      const res = await env.ASSETS.fetch(new Request(target,{method:request.method}));
      const headers = new Headers(res.headers); for (const [k,v] of Object.entries(secureHeaders)) headers.set(k,v);
      return new Response(res.body,{status:res.status,headers});
    } catch { return json({error:'服务暂时不可用，请检查 D1 绑定和数据库迁移'},503); }
  }
};
