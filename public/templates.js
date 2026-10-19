const definitions = [
  ['full-noauto','Full_NoAuto','Full No Auto','完整分流，所有地区手动选点，无后台自动测速。','Full routing with manual regional selection; no automatic latency tests.','full','manual'],
  ['full','Full','Full','完整应用、流媒体、游戏和地区分组，自动测速。','Detailed app, streaming, gaming and regional groups with latency tests.','full','auto'],
  ['online','','Online','标准分流，常用服务、广告过滤与自动选点。','Balanced routing for common services, ad filtering and automatic selection.','standard','auto'],
  ['noauto','NoAuto','No Auto','标准分流，手动选择节点，减少测速流量。','Standard routing with manual node selection and no background tests.','standard','manual'],
  ['adblock','AdblockPlus','Adblock Plus','标准分流，增加广告过滤规则。','Standard routing with extended advertising filters.','standard','auto'],
  ['multicountry','MultiCountry','Multi Country','标准分流，按国家和地区组织节点。','Standard routing with country and region node groups.','standard','auto'],
  ['noreject','NoReject','No Reject','标准分流，不启用广告拦截策略。','Standard routing without advertising rejection policies.','standard','auto'],
  ['full-adblock','Full_AdblockPlus','Full Adblock Plus','完整分组，并增加广告过滤规则。','Full service groups with extended advertising filters.','full','auto'],
  ['full-google','Full_Google','Full Google','完整分流，细分 Google 服务策略。','Full routing with dedicated Google service policies.','full','auto'],
  ['full-netflix','Full_Netflix','Full Netflix','完整分流，细分 Netflix 相关策略。','Full routing with additional Netflix policies.','full','auto'],
  ['full-multimode','Full_MultiMode','Full Multi Mode','完整分流，提供测速、故障转移和负载均衡。','Full routing with latency tests, fallback and load balancing.','full','multi'],
  ['mini','Mini','Mini','精简策略分组，适合少量节点与日常使用。','Compact policy groups for a small collection and everyday use.','mini','auto'],
  ['mini-noauto','Mini_NoAuto','Mini No Auto','精简分流，手动选点，无自动测速。','Compact routing with manual selection and no latency tests.','mini','manual'],
  ['mini-adblock','Mini_AdblockPlus','Mini Adblock Plus','精简分组，保留增强广告过滤。','Compact groups with extended advertising filters.','mini','auto'],
  ['mini-ai','Mini_Ai','Mini AI','精简分流，增加 AI 平台独立策略。','Compact routing with a dedicated AI platform policy.','mini','auto'],
  ['mini-fallback','Mini_Fallback','Mini Fallback','精简分流，使用故障转移自动切换可用节点。','Compact routing with automatic failover to an available node.','mini','fallback'],
  ['mini-multicountry','Mini_MultiCountry','Mini Multi Country','精简分组，保留常用国家和地区策略。','Compact routing with country and region selection.','mini','auto'],
  ['mini-multimode','Mini_MultiMode','Mini Multi Mode','精简分组，提供多种自动选择策略。','Compact groups with multiple automatic selection modes.','mini','multi']
];
export const templates = definitions.map(([id,suffix,label,zh,en,family,mode]) => ({
  id, name:`ACL4SSR Online${label === 'Online' ? '' : ' ' + label}`,
  description:{zh,en},family,mode,
  url:`https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online${suffix ? '_'+suffix : ''}.ini`
}));
export const templateById = id => templates.find(t => t.id === id);
templates.splice(1,0,{
  id:'full-noauto-steam-web',name:'ACL4SSR Online Full No Auto · Steam Store & Community',
  description:{zh:'自定义模板：Steam 商店与社区独立分组；登录、CM、API 和已覆盖的下载域名固定直连。直连使用本地出口，不保证国内 IP 或国内 CDN。',en:'Custom preset: separate Steam store/community policy; login, CM, API and covered downloads use DIRECT. Direct uses your local exit; a Chinese IP/CDN is not guaranteed.'},
  family:'full',mode:'manual',custom:true,
  url:templates[0].url
});
export const DEFAULT_TEMPLATE = 'full-noauto';
