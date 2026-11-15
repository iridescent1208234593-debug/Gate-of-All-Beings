import { getPref, setPref } from './prefs.js';
export const messages = {
  zh: {
    title: 'softie · 软乎乎。', description: '一团软乎乎的 WebGPU 史莱姆。捏一捏，拖一拖，把今天放轻松。',
    home: 'softie 首页', tagline: '留一点空间，放轻松', heading: '软乎乎。', intro: '捏一捏，把今天放轻松。',
    language: '界面语言', chinese: '中文', english: 'English 英文', soundToggle: '音效开关', soundOn: '音效开启', soundOff: '静音', githubRepo: 'GitHub 仓库',
    canvas: '互动史莱姆：按住揉捏，拖动拎起；双指合拢挤压、分开拉伸，松手回弹。也可以按空格键戳一下。',
    loading: '让软乎乎醒过来…', waiting: '无法启动灵体互动', settings: '随你揉捏', settingsNote: '把心情捏成喜欢的样子',
    settingsLabel: '史莱姆设置', color: '颜色', strawberry: '草莓史莱姆', mint: '薄荷史莱姆', grape: '葡萄史莱姆', custom: '自定义颜色',
    strawberryLabel: '草莓史莱姆，粉色', mintLabel: '薄荷史莱姆，青绿色', grapeLabel: '葡萄史莱姆，淡紫色', customLabel: '自定义颜色',
    stiffness: '软硬', damping: '阻尼', volume: '音量', volumeMute: '静音', volumeMax: '最大', soft: '糯叽叽', springy: '有弹性', wobbly: '晃悠悠', settled: '很乖巧',
    poke: '戳一下', pokeTitle: '戳一下 · 空格键', reset: '恢复默认', spiritPlayground: '灵体试验场', spiritPlaygroundTitle: '进入灵体试验场',
    connecting: '连接 WebGPU', connected: 'WebGPU', disconnected: 'WebGPU 未连接', fps: '实时帧率',
    hold: '按住揉捏', drag: '拖动拎起', release: '松手回弹', footer: '慢一点，也没关系。',
    gpuUnsupported: '这个浏览器没有启用 WebGPU，灵体互动无法运行。请用 Chrome / Edge / Safari 的新版打开；微信、QQ 等 App 内置的浏览器通常不支持，可以复制链接到系统浏览器再打开。',
    nativeRequired: '当前浏览器只提供了软件模拟的 WebGPU，无法运行灵体互动。请换用 Chrome / Edge / Safari 的新版打开。', deviceLost: 'WebGPU 设备连接已中断，请刷新页面重新连接。',
    initFailed: '灵体互动启动失败。请刷新页面；仍然不行的话，用 Chrome / Edge / Safari 的新版打开（微信等内置浏览器通常不支持）。',
    moodChill: '佛系放空', moodAnnoyed: '有点烦躁', moodRage: '暴怒红温！', moodSleepy: '摸鱼打盹中…',
    moodLabel: '心情状态', workerQuote: '在工位上，我是一团没有骨头的果冻。', pokeAngry: '别戳了！',
    accessory: '打工装扮', accNone: '素颜', accBadge: '工牌', accCoffee: '冰美式', accBandaid: '创可贴',
    accNoneLabel: '素颜无配件', accBadgeLabel: '打工人工牌', accCoffeeLabel: '续命冰美式', accBandaidLabel: '战损创可贴',
    rageTitle: '打工怨气槽', rageChill: '摸鱼放空中', rageAnnoyed: '有点上火', rageHot: '暴怒升温', rageMax: 'MAX 怨气爆表!', rageSleepy: '呼噜充能中…', rageMeterLabel: '打工怨气进度条',
  },
  en: {
    title: 'softie · Soft & squishy.', description: 'A soft little WebGPU slime. Squish, stretch, and let the day feel lighter.',
    home: 'softie home', tagline: 'A LITTLE ROOM TO PLAY', heading: 'Softie.', intro: 'A little squish. A lighter day.',
    language: 'Interface language', chinese: '中文 Chinese', english: 'English', soundToggle: 'Sound toggle', soundOn: 'Sound on', soundOff: 'Muted', githubRepo: 'GitHub Repository',
    canvas: 'Interactive slime: hold to squish, drag to lift, pinch two fingers to squeeze or spread to stretch, and release to bounce. You can also press Space to poke.',
    loading: 'Waking softie up…', waiting: 'Cannot start the spirit playground', settings: 'Make it yours', settingsNote: 'A LITTLE MOOD MAKEOVER',
    settingsLabel: 'Slime settings', color: 'Color', strawberry: 'Strawberry slime', mint: 'Mint slime', grape: 'Grape slime', custom: 'Custom color',
    strawberryLabel: 'Strawberry slime, pink', mintLabel: 'Mint slime, mint green', grapeLabel: 'Grape slime, lavender', customLabel: 'Custom color',
    stiffness: 'Firmness', damping: 'Damping', volume: 'Volume', volumeMute: 'Mute', volumeMax: 'Max', soft: 'Squishy', springy: 'Springy', wobbly: 'Wobbly', settled: 'Settled',
    poke: 'Poke me', pokeTitle: 'Poke me · Space', reset: 'Reset', spiritPlayground: 'Spirit Playground', spiritPlaygroundTitle: 'Enter Spirit Playground',
    connecting: 'Connecting WebGPU', connected: 'WebGPU', disconnected: 'WebGPU disconnected', fps: 'Live frame rate',
    hold: 'Hold to squish', drag: 'Drag to lift', release: 'Release to bounce', footer: 'Take your time.',
    gpuUnsupported: 'This browser does not expose WebGPU, so the spirit playground cannot run. Open this page in a recent Chrome, Edge or Safari. In-app browsers (WeChat, QQ, etc.) usually do not support it — copy the link into a system browser.',
    nativeRequired: 'This browser only offers a software WebGPU, which cannot run the spirit playground. Please use a recent Chrome, Edge or Safari.', deviceLost: 'The WebGPU device disconnected. Refresh the page to reconnect.',
    initFailed: 'The spirit playground failed to start. Refresh the page; if it still fails, open it in a recent Chrome, Edge or Safari (in-app browsers usually do not support it).',
    moodChill: 'Chill & Cozy', moodAnnoyed: 'Slightly Annoyed', moodRage: 'Raging Hot!', moodSleepy: 'Slacking & Napping…',
    moodLabel: 'Current Mood', workerQuote: 'At work, I am just a boneless jelly.', pokeAngry: 'Stop poking!',
    accessory: 'Accessories', accNone: 'Clean', accBadge: 'ID Badge', accCoffee: 'Iced Coffee', accBandaid: 'Band-aid',
    accNoneLabel: 'Clean without accessories', accBadgeLabel: 'Worker ID Badge', accCoffeeLabel: 'Lifesaver Iced Americano', accBandaidLabel: 'War-damaged band-aid',
    rageTitle: 'Fury Gauge', rageChill: 'Chill & Slacking', rageAnnoyed: 'Simmering', rageHot: 'Heating Up', rageMax: 'MAX RAGE!', rageSleepy: 'Napping…', rageMeterLabel: 'Slime fury progress meter',
  },
};

export function getCurrentLanguage() {
  try {
    const saved = getPref('softie-language');
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* Storage may be disabled. */ }
  return document.documentElement.lang?.startsWith('en') ? 'en' : 'zh';
}

export function translate(language, key) {
  return messages[language]?.[key] ?? messages.zh[key];
}

