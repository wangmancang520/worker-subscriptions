import {parseNodes} from './nodes.js';
import {templates,templateById,DEFAULT_TEMPLATE} from './templates.js';
import {zh,en} from './i18n.js';
const $ = id => document.getElementById(id);
const preferences = {get(key) {try {return localStorage.getItem(key);} catch {return null;}},set(key,value) {try {localStorage.setItem(key,value);} catch {}}};
const preferredLanguage = preferences.get('nodebook-language');
let language = ['zh','en'].includes(preferredLanguage) ? preferredLanguage : (/^zh-(CN|Hans)(-|$)/i.test(navigator.language) ? 'zh' : 'en');
let theme = preferences.get('nodebook-theme') || 'system';
if (!['system','light','dark'].includes(theme)) theme = 'system';
let view = 'landing', secret = '', revision = 0, busy = false, dirty = false, selectedTemplate = DEFAULT_TEMPLATE, parsed = [], toastTimer;
let savedNodes = '', savedTemplate = DEFAULT_TEMPLATE;
const t = key => (language === 'zh' ? zh : en)[key] || key;
const nodeCount = n => `${n} ${language === 'en' && n === 1 ? 'node' : t('count')}`;
const validKey = value => /^[A-Za-z0-9_-]{16,128}$/.test(value);
function toast(key,error=false,literal=false) {
  clearTimeout(toastTimer); $('status').hidden=false; $('status').className='status'+(error?' error':''); $('status').textContent=literal?key:t(key);
  if (!error) toastTimer=setTimeout(()=>{$('status').hidden=true;},4500);
}
function hideSecrets() {for(const id of ['subscription','saved-key','edit-url']) $(id).type='password'; updateReveal();}
function updateReveal() {document.querySelectorAll('[data-reveal]').forEach(button=>{const shown=$(button.dataset.reveal).type==='text';button.textContent=t(shown?'hide':'show');button.setAttribute('aria-pressed',String(shown));button.setAttribute('aria-controls',button.dataset.reveal);});}
function go(next,{replace=false,history=true}={}) {
  if(next==='nodes'&&!secret) next='access';
  if(next==='result'&&!revision) next='nodes';
  view=next; $('flow').hidden=next==='landing';
  for(const id of ['landing','access','nodes','result']) $(id).hidden=id!==next;
  const index=['access','nodes','result'].indexOf(next);
  document.querySelectorAll('[data-step]').forEach((item,i)=>{item.className=i===index?'active':i<index?'complete':''; if(i===index)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
  $('status').hidden=true;
  if(next==='result') renderResult();
  const path=secret&&revision ? `/${secret}` : '/';
  const hash=next==='landing'?'':next==='nodes'&&revision?'':`#${next}`;
  if(history) window.history[replace?'replaceState':'pushState']({view:next},'',path+hash);
  document.title=`${next==='landing'?t('brand'):t({access:'step1',nodes:'step2',result:'step3'}[next])} · Nodebook`;
  window.scrollTo({top:0,behavior:'instant'});
  $(next==='landing'?'hero-title':`${next}-title`).focus({preventScroll:true});
}
function applyTheme() {
  if(theme==='system') delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;
  $('theme-label').textContent=t(theme);$('theme-icon').textContent={system:'◐',light:'☼',dark:'☾'}[theme];$('theme').setAttribute('aria-label',t('themeAria'));
}
function localize() {
  document.documentElement.lang=language==='zh'?'zh-CN':'en';
  document.querySelectorAll('[data-t]').forEach(el=>{el.textContent=t(el.dataset.t);});
  document.querySelectorAll('[data-placeholder]').forEach(el=>el.placeholder=t(el.dataset.placeholder));
  $('language').textContent=language==='zh'?'中 / EN':'EN / 中';$('language').setAttribute('aria-label',t('languageAria'));
  document.querySelector('.progress').setAttribute('aria-label',language==='zh'?'操作步骤':'Progress');
  $('status').hidden=true;applyTheme();updateReveal();renderTemplates();validate();
  if(view==='result') renderResult();
  document.title=view==='landing'?t('brand'):`${t({access:'step1',nodes:'step2',result:'step3'}[view])} · Nodebook`;
}
function renderTemplates() {
  const query=$('template-search').value.trim().toLowerCase(),filter=$('template-filter').value;
  const matches=templates.filter(item=>(filter==='all'||item.family===filter||item.mode===filter)&&`${item.name} ${item.description.zh} ${item.description.en}`.toLowerCase().includes(query));
  $('template-select').replaceChildren();
  for(const item of matches) {const option=document.createElement('option');option.value=item.id;option.textContent=`${item.id===DEFAULT_TEMPLATE?'✦ ':''}${item.name} · ${t(item.mode)}`;option.selected=item.id===selectedTemplate;$('template-select').append(option);}
  if(!matches.length){const option=new Option(t('noTemplates'),'');option.disabled=true;$('template-select').append(option);}
  // Filtering does not silently change the saved selection.
  $('template-select').value=matches.some(x=>x.id===selectedTemplate)?selectedTemplate:'';
  renderDetail();
}
function renderDetail() {
  const item=templateById(selectedTemplate);const box=$('template-detail');box.replaceChildren();
  if(!item)return;
  const badge=document.createElement('span');badge.className='chip';badge.textContent=`${t('selected')} · ${t(item.family)} · ${t(item.mode)}`;
  const title=document.createElement('strong');title.textContent=item.name;
  const desc=document.createElement('p');desc.textContent=item.description[language];
  const note=document.createElement('p');note.textContent=item.mode==='manual'?t('manualHint'):t('regionHint');
  box.append(badge,title,desc,note);
}
function validate() {
  const text=$('node-input').value;const lines=text.split(/\r?\n/).filter(line=>line.trim());const counts={vless:0,trojan:0};
  for(const line of lines) {const type=line.trim().split(':')[0].toLowerCase();if(type in counts)counts[type]++;}
  $('node-count').replaceChildren();
  for(const label of [nodeCount(lines.length),...Object.entries(counts).filter(([,n])=>n).map(([type,n])=>`${type==='vless'?'VLESS':'Trojan'} ${n}`)]) {const chip=document.createElement('span');chip.className='chip';chip.textContent=label;$('node-count').append(chip);}
  parsed=[];let valid=false;
  try {
    if(new TextEncoder().encode(JSON.stringify({nodes:text,revision,template:selectedTemplate})).length>131072)throw Error(t('tooLarge'));
    parsed=parseNodes(text,language);valid=true;$('validation').textContent=t('valid');$('validation').className='validation valid';
  }catch(error){$('validation').textContent=text.trim()?error.message:t('empty');$('validation').className='validation'+(text.trim()?' error':'');}
  $('node-input').setAttribute('aria-invalid',String(Boolean(text.trim())&&!valid));
  $('save').disabled=busy||!valid||!templateById(selectedTemplate);return valid;
}
function setBusy(value){busy=value;for(const id of ['open','create','node-input','template-search','template-filter','template-select','key-input','nodes-back'])$(id).disabled=value;validate();}
function updateDirty(){dirty=$('node-input').value!==savedNodes||selectedTemplate!==savedTemplate;}
async function load(key) {
  if(!validKey(key)){toast('invalidKey',true);return;}
  setBusy(true);toast('loading');
  try {
    const response=await fetch(`/api/profiles/${key}`,{cache:'no-store'});
    if(!response.ok){toast(response.status===404?'missing':'service',true);return;}
    const data=await response.json();secret=key;revision=data.revision;selectedTemplate=templateById(data.template)?data.template:'online';
    $('node-input').value=data.nodes;savedNodes=data.nodes;savedTemplate=selectedTemplate;dirty=false;
    $('template-search').value='';$('template-filter').value='all';renderTemplates();validate();go('nodes',{replace:true});
  }catch{toast('network',true);}finally{setBusy(false);}
}
function renderResult(){
  $('subscription').value=`${location.origin}/${secret}/sub`;$('saved-key').value=secret;$('edit-url').value=`${location.origin}/${secret}`;
  $('saved-count').textContent=nodeCount(parsed.length);hideSecrets();
}
$('start').onclick=()=>go('access');
$('create').onclick=()=>{
  if(busy)return;
  secret=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');revision=0;selectedTemplate=DEFAULT_TEMPLATE;
  $('node-input').value='';savedNodes='';savedTemplate=DEFAULT_TEMPLATE;dirty=false;$('template-search').value='';$('template-filter').value='all';
  renderTemplates();validate();go('nodes');
};
$('access-form').onsubmit=e=>{e.preventDefault();if(!busy)load($('key-input').value.trim());};
$('node-input').oninput=()=>{updateDirty();validate();};
$('template-search').oninput=renderTemplates;$('template-filter').onchange=renderTemplates;
$('template-select').onchange=()=>{if(templateById($('template-select').value)){selectedTemplate=$('template-select').value;updateDirty();renderDetail();validate();}};
$('editor').onsubmit=async e=>{
  e.preventDefault();if(busy||!validate())return;
  setBusy(true);toast('saving');
  try {
    const response=await fetch(`/api/profiles/${secret}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nodes:$('node-input').value,revision,template:selectedTemplate})});
    if(!response.ok){const key=response.status===409?'conflict':response.status===503?'service':response.status===413?'tooLarge':'saveError';toast(key,true);return;}
    const data=await response.json();revision=data.revision;savedNodes=$('node-input').value;savedTemplate=selectedTemplate;dirty=false;go('result');
  }catch{toast('network',true);}finally{setBusy(false);}
};
$('nodes-back').onclick=()=>{if(!dirty||confirm(t('discard'))){$('node-input').value=savedNodes;selectedTemplate=savedTemplate;dirty=false;go('access');}};
$('edit-again').onclick=()=>go('nodes');
$('language').onclick=()=>{language=language==='zh'?'en':'zh';preferences.set('nodebook-language',language);localize();};
$('theme').onclick=()=>{theme={system:'light',light:'dark',dark:'system'}[theme];preferences.set('nodebook-theme',theme);applyTheme();};
for(const button of document.querySelectorAll('[data-reveal]'))button.onclick=()=>{const input=$(button.dataset.reveal);input.type=input.type==='password'?'text':'password';updateReveal();};
for(const button of document.querySelectorAll('[data-copy]'))button.onclick=async()=>{
  const input=$(button.dataset.copy);
  try{await navigator.clipboard.writeText(input.value);toast('copied');}catch{input.type='text';input.select();updateReveal();toast('copyFailed',true);}
};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('popstate',event=>{
  if(dirty&&!confirm(t('discard'))){go(view,{replace:true});return;}
  if(dirty){$('node-input').value=savedNodes;selectedTemplate=savedTemplate;dirty=false;renderTemplates();validate();}
  go(event.state?.view||(secret&&revision?'nodes':'landing'),{history:false});
});
localize();
const pathKey=location.pathname.split('/').filter(Boolean)[0];
if(pathKey){go('access',{history:false});load(pathKey);}else go(location.hash==='#access'?'access':'landing',{replace:true});
