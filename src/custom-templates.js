// Local overlays keep upstream templates intact. Add future platform presets here.
export const STEAM_WEB_TEMPLATE = 'full-noauto-steam-web';
export const STEAM_WEB_GROUP = '🎮 Steam 商店与社区';

export function applyCustomTemplate(config, templateId) {
  if (templateId !== STEAM_WEB_TEMPLATE) return config;
  const web = [
    'DOMAIN-SUFFIX,store.steampowered.com',
    'DOMAIN-SUFFIX,checkout.steampowered.com',
    'DOMAIN-SUFFIX,steamcommunity.com',
    'DOMAIN,community.steam-api.com',
    'DOMAIN,avatars.steamstatic.com',
    'DOMAIN,avatars.akamai.steamstatic.com',
    'DOMAIN,avatars.cloudflare.steamstatic.com',
    'DOMAIN,avatars.fastly.steamstatic.com',
    'DOMAIN,images.steamusercontent.com',
    'DOMAIN,steamcommunity-a.akamaihd.net',
    'DOMAIN,steamstore-a.akamaihd.net',
    'DOMAIN,steamuserimages-a.akamaihd.net',
    'DOMAIN,steamusercontent-a.akamaihd.net',
    ...['store','community','shared'].flatMap(prefix => [
      ...['akamai','cloudflare','fastly'].map(cdn => `DOMAIN,${prefix}.${cdn}.steamstatic.com`),
      `DOMAIN,${prefix}.cdn.queniuqe.com`,
      `DOMAIN,${prefix}.st.dl.eccdnx.com`
    ])
  ];
  // Use DIRECT itself: changing the generic gaming/global-direct group must not
  // move login, CM or download traffic onto a proxy. Web exceptions go first.
  const direct = [
    ...['steampowered.com','steamcontent.com','steamusercontent.com','steamserver.net',
      'steam-api.com','steam-chat.com','steamchina.com'].map(d => `DOMAIN-SUFFIX,${d}`),
    ...['steampipe.akamaized.net','steampipe-kr.akamaized.net','steampipe-partner.akamaized.net',
      'steamcdn-a.akamaihd.net','client-update.queniuqe.com','gstore.val.manlaxy.com']
      .map(d => `DOMAIN,${d}`)
  ];
  const cn = Object.entries(config['rule-providers']).find(([,p]) => p.url.endsWith('/SteamCN.list'));
  if (cn) direct.push(`RULE-SET,${cn[0]}`);
  const group = {name:STEAM_WEB_GROUP,type:'select',proxies:[
    '🚀 节点选择','DIRECT',...config.proxies.map(p => p.name)
  ]};
  if (!config['proxy-groups'].some(g => g.name === '🚀 节点选择')) throw new Error('Steam preset requires the Full No Auto base');
  return {...config,'proxy-groups':[...config['proxy-groups'],group],rules:[
    ...web.map(rule => `${rule},${STEAM_WEB_GROUP}`),
    ...direct.map(rule => `${rule},DIRECT`),...config.rules
  ]};
}
