const $ = id => document.getElementById(id);
let revision = 0, loadedSecret = '', busy = false, dirty = false;
const message = (text, error = false) => { $('status').textContent = text; $('status').className = error ? 'error' : ''; };
const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2,'0')).join('');
function count() { $('count').textContent = `${$('nodes').value.split(/\r?\n/).filter(s => s.trim()).length} 个节点`; }
function showLinks(secret) { $('subscription').value = `${location.origin}/${secret}/sub`; $('edit-url').value = `${location.origin}/${secret}`; $('result').hidden = false; }
function lock(value) {busy = value; for (const id of ['save','open','generate','secret','nodes']) $(id).disabled = value;}
async function load(secret) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(secret)) return message('暗号需为 16–128 位字母、数字、_ 或 -',true);
  lock(true); $('result').hidden = true;
  try {
    const res = await fetch(`/api/profiles/${secret}`,{cache:'no-store'}); const data = await res.json();
    if (!res.ok && res.status !== 404) throw new Error(data.error);
    loadedSecret = secret; revision = data.revision || 0; $('secret').value = secret; $('nodes').value = data.nodes || ''; dirty = false; count();
    history.replaceState(null,'',`/${secret}`);
    if (res.ok) {showLinks(secret); message(`已加载 · 最后保存于 ${new Date(data.updated_at).toLocaleString()}`);} else message('这是一个新暗号。粘贴节点后保存即可创建订阅。');
  } catch(e) {message(e.message || '加载失败，请重试',true);} finally {lock(false);}
}
$('open').onclick = () => { if (!dirty || confirm('尚有未保存的节点，确认打开其他暗号？')) load($('secret').value.trim()); };
$('generate').onclick = () => {if (dirty && !confirm('随机生成将清空当前未保存内容，继续？')) return; revision = 0; loadedSecret = randomSecret(); $('secret').value = loadedSecret; $('nodes').value = ''; dirty = false; count(); $('result').hidden = true; history.replaceState(null,'','/'); message('新暗号已生成，添加节点后保存。');};
$('secret').oninput = () => {$('result').hidden = true;};
$('nodes').oninput = () => {dirty = true; count();};
$('editor').onsubmit = async event => {
  event.preventDefault(); if (busy) return;
  const secret = $('secret').value.trim();
  if (secret !== loadedSecret) return message('暗号已更改，请先点击「打开」加载或创建该暗号，再编辑节点。',true);
  lock(true); message('正在校验并保存…');
  try {
    const res = await fetch(`/api/profiles/${secret}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nodes:$('nodes').value,revision})});
    const data = await res.json(); if (!res.ok) throw new Error(data.error);
    revision = data.revision; dirty = false; history.replaceState(null,'',`/${secret}`); showLinks(secret); message('已保存。客户端更新订阅即可获取最新节点。');
  } catch(e) {message(e.message || '保存失败，请重试',true);} finally {lock(false);}
};
for (const [button,input] of [['copy-sub','subscription'],['copy-edit','edit-url']]) $(button).onclick = async () => {try {await navigator.clipboard.writeText($(input).value); message('地址已复制');} catch {$ (input).select(); message('无法自动复制，请手动复制已选中的地址。',true);}};
window.addEventListener('beforeunload', e => {if (dirty) {e.preventDefault(); e.returnValue = '';}});
const initial = location.pathname.split('/').filter(Boolean)[0];
if (initial) load(initial); else $('generate').click();
