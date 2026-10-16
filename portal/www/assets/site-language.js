/* Small first-party UI locale switch shared by Iridescently subdomains. */
(function () {
  'use strict';
  if (window.IridescentlyLanguage) return;

  var COOKIE = 'iridescently-language';
  var EN = {
    '主页': 'Home', '西木会馆': 'Ximu Hall', '众生之门': 'Gate of All Beings',
    '佳霖馆长设定': 'Jialin’s Character', '心理档案云': 'Psyche Archive',
    '配色海报工坊': 'Color Poster Studio', '连接与鸣谢': 'Connections & Credits',
    '更多去处': 'More', '站点导航': 'Site navigation', '本页目录': 'On this page',
    '尚未并入本站': 'Not yet integrated', '状态检测中': 'Checking status',
    '状态未知': 'Status unknown', '在线': 'Online', '离线': 'Offline',
    '登录 / 注册': 'Sign in / Register', '账户': 'Account', '成员管理': 'Members',
    '去登录 / 注册': 'Go to sign in / register', '账号': 'Account',
    '退出': 'Sign out', '版权与免责声明': 'Copyright & disclaimer',
    '官网 ↗': 'Website ↗', 'Iridescently 官网': 'Iridescently website',
    '版权': 'Copyright', '登录': 'Sign in', '注册': 'Register', '取消': 'Cancel',
    '保存': 'Save', '删除': 'Delete', '编辑': 'Edit', '提交': 'Submit',
    '重置': 'Reset', '搜索': 'Search', '关闭': 'Close', '返回': 'Back',
    '确认': 'Confirm', '加载中…': 'Loading…', '加载中...': 'Loading…',
    '重新连接': 'Reconnect', '上一张贺图': 'Previous artwork',
    '下一张贺图': 'Next artwork', '开启自动播放': 'Enable autoplay',
    '关闭自动播放': 'Disable autoplay', '播放音乐': 'Play music',
    '暂停音乐': 'Pause music', '上一首': 'Previous track', '下一首': 'Next track',
    '播放进度': 'Playback position', '打开自定义设置': 'Open appearance settings',
    '恢复默认': 'Restore defaults', '自定义': 'Appearance', '过渡': 'Transition',
    '停留': 'Hold', '大小': 'Size', '微动': 'Motion', '晕染': 'Blend',
    '颗粒': 'Grain', '自动播放': 'Autoplay', '正在播放': 'Now playing',
    '节气贺图图库': 'Seasonal artwork gallery', '节气之间，自有天气': 'Weather between the solar terms',
    '滚动或使用方向键浏览': 'Scroll or use the arrow keys to browse',
    '轻扫，继续浏览': 'Swipe to browse', '跳至节气图库': 'Skip to the gallery',
    '正在进入节气图库': 'Opening the seasonal gallery', '连接与鸣谢': 'Connections & Credits',
    '项目足迹': 'Project history', '开源与构建': 'Open source & built with',
    '友站与邻居': 'Friends & neighbors', '特别感谢': 'Special thanks',
    '联系与讨论': 'Contact & discussion', '来自 Iridescently': 'From Iridescently',
    '一点一点，走到这里': 'Built one step at a time', '阶段记录 · 横向滑动查看': 'Milestones · swipe horizontally',
    '官方角色档案': 'Official character archive', '人设登记': 'Character registration',
    '同人角色档案': 'Fan character archive', '角色画廊': 'Character gallery',
    '人物关系图': 'Character relationships', '罗小黑表情包收录': 'Luo Xiaohei stickers',
    '申请成为编辑': 'Apply to become an editor', '角色设定': 'Character profile',
    '基本信息': 'Basic information', '角色配色': 'Character colors',
    '自定义角色配色海报': 'Custom character color poster', '姓名': 'Name',
    '性别': 'Gender', '年龄': 'Age', '身高': 'Height', '种族': 'Species',
    '组织': 'Organization', '阵营': 'Alignment', '性格': 'Personality',
    '外貌': 'Appearance', '背景': 'Background', '简介': 'Introduction',
    '备注': 'Notes', '喜欢': 'Likes', '不喜欢': 'Dislikes', '食物': 'Favorite food',
    '上传图片': 'Upload images', '选择图片': 'Choose images', '未填写': 'Not provided',
    '人类': 'Human', '妖精': 'Spirit', '男': 'Male', '女': 'Female', '其他': 'Other',
    '提交登记': 'Submit registration', '更新登记': 'Update registration',
    '登录后可继续': 'Sign in to continue', '请先登录': 'Please sign in first',
    '保存成功': 'Saved successfully', '保存失败，请重试': 'Could not save. Please try again.',
    '网络错误，请重试': 'Network error. Please try again.', '请求失败，请重试': 'Request failed. Please try again.',
    '请输入': 'Please enter', '必填': 'Required', '可选': 'Optional',
    '跳过': 'Skip', '跳过开场': 'Skip intro', '进入众生之门': 'Enter the Gate',
    '返回开场': 'Back to intro', '开始': 'Start', '继续': 'Continue',
    '公告': 'Announcements', '设置': 'Settings', '帮助': 'Help', '关于': 'About',
    '罗小黑战记 · 非商业同人': 'The Legend of Luo Xiaohei · Fan project',
    '单指旋转 · 双指缩放': 'Drag to rotate · Pinch to zoom',
    '门已开启': 'The gate is open', '正在开启众生之门…': 'Opening the Gate…',
    '开场动画进度': 'Intro progress', '关闭声音': 'Mute sound', '开启声音': 'Enable sound',
    '读取存档': 'Loading save', '正在保存': 'Saving', '已自动保存': 'Saved automatically',
    '存档不可用 · 可导出备份': 'Save unavailable · export a backup',
    '保存失败 · 请导出备份': 'Save failed · export a backup',
    '门庭': 'Home', '入世历练': 'Adventure', '灵境会馆': 'Spirit Hall',
    '会馆日常': 'Hall life', '灵卡图鉴': 'Card collection', '旅途手札': 'Travel journal',
    '万灵志': 'Spirit index', '灵境生态': 'Spirit ecology', '导出存档': 'Export save',
    '导入 JSON': 'Import JSON', '导出 JSON': 'Export JSON', '开始历练': 'Begin adventure',
    '保存时间线': 'Save timeline', '已保存，下次启程生效': 'Saved · takes effect next journey',
    '事件名称': 'Event name', '抵达层数': 'Floor', '赠礼': 'Reward',
    '恢复生命': 'Restore health', '获得灵石': 'Gain spirit stones', '生命上限成长': 'Increase max health',
    '上移': 'Move up', '下移': 'Move down', '删除事件': 'Delete event',
    '＋ 写下一场相遇': '＋ Add an encounter', '导出行动记录': 'Export action log',
    '故事与角色档案': 'Stories and character archives',
    '佳霖的原创角色设定页': 'Jialin’s original character profile',
    '尚未有人设登记。快来提交第一份吧。': 'No character files yet. Be the first to add one.',
    '展示页': 'View profile', '彻底删除': 'Delete permanently', '恢复': 'Restore',
    '为下一局安排相遇。': 'Arrange encounters for your next journey.',
    '当前旅途使用启程时的时间线，不受这里的修改影响。': 'The current run keeps the timeline it started with.',
    '事件在抵达指定层数时触发。': 'Events trigger when you reach their assigned floor.',
    '时间线文件过大。': 'Timeline file is too large.', '新的相遇': 'New encounter',
    '请启用 JavaScript 后进入众生之门。': 'Enable JavaScript to enter the Gate of All Beings.',
    '中文': '中文', 'English': 'English', '简体中文': 'Simplified Chinese',
    'Iridescently 首页': 'Iridescently home', '鼠标悬停或点按切换颜文字': 'Hover or tap to change the face',
    '继续探索': 'Explore more', '节气之间，自有天气': 'Weather between the solar terms',
    '网站、会馆和设表系统，是大家一起折腾出来的。这里记下项目的进展、借助的开源项目、相邻的站点，以及一路提出建议、帮忙测试和陪伴的朋友。': 'The site, Hall, and character tools were built together. This page records the project’s progress, the open-source tools it uses, neighboring sites, and the friends who shared ideas, tested, and stayed along the way.',
    '让画面里的色彩慢慢铺展成氛围。': 'Let the colors in each image unfold into atmosphere.',
    '让画面里的色彩慢慢铺展成氛围。': 'Let the colors in each image unfold into atmosphere.',
    '网站、会馆和设表系统，是大家一起折腾出来的。': 'The site, Hall, and character tools were built together.',
    '这里记下项目的进展、借助的开源项目、相邻的站点，以及一路提出建议、帮忙测试和陪伴的朋友。': 'Here we record the project’s progress, the open-source tools it uses, neighboring sites, and the friends who shared ideas, tested, and stayed along the way.',
    '阶段记录 · 横向滑动查看': 'Milestones · swipe horizontally', '官方角色图鉴': 'Official character index',
    '完成官方角色画廊图鉴的初级编汇。': 'Initial compilation of the official character gallery.',
    '人物关系图谱': 'Character relationships', '完成官方角色关系图谱。': 'Completed the official character relationship map.',
    '同人角色画廊': 'Fan character gallery', '完成同人角色画廊。': 'Completed the fan character gallery.',
    '聚灵小游戏': 'Spirit Gathering game', '完成聚灵小游戏。': 'Completed the Spirit Gathering game.',
    '肉鸽卡牌游戏': 'Roguelike card game', '完成重生之门肉鸽卡牌游戏。': 'Completed the Rebirth Gate roguelike card game.',
    '完成经营模拟游戏。': 'Completed the management simulation game.', '项目整理': 'Project organization',
    '优化项目文件与目录。': 'Improved the project files and directory structure.',
    '灵体互动': 'Spirit interaction', '完成灵体互动联机版。': 'Completed the online spirit interaction mode.',
    '接下来': 'Next', '还在继续折腾': 'Still in progress', '更多游戏与捏脸系统，继续探索中。': 'More games and character customization are in the works.',
    '这些项目各自承担了清晰的一部分：绘制空间、读取色彩、组织页面与构建代码。': 'Each project has a clear role: rendering scenes, reading colors, organizing pages, and building code.',
    '探索项目': 'Explore the project', '访问网站': 'Visit website',
    '按 Enter 搜索': 'Press Enter to search', '搜索角色': 'Search characters',
    '选择角色': 'Choose a character', '选择文件': 'Choose file', '上传头像': 'Upload avatar',
    '更新资料': 'Update profile', '退出登录': 'Sign out', '我的账户': 'My account',
    '账户资料': 'Account details', '修改密码': 'Change password', '保存更改': 'Save changes',
    '保存设置': 'Save settings', '发送': 'Send', '重试': 'Try again', '查看更多': 'View more',
    '返回开场加载动画': 'Return to the opening animation', '玩法说明': 'How to play',
    '登录或注册账户': 'Sign in or register an account', '查阅《罗小黑战记》世界里的角色与官方记录。': 'Browse characters and official records from The Legend of Luo Xiaohei.',
    '为你的角色留下一份属于会馆的档案。': 'Create an archive for your character in the Hall.',
    '看看其他创作者的角色，也分享属于你的故事。': 'Explore other creators’ characters and share your own story.',
    '搜索官方角色': 'Search official characters', '正在翻开官方档案…': 'Opening official archives…',
    '正在查阅你的登记…': 'Loading your registered characters…', '正在翻开公开档案…': 'Opening public archives…',
    '更多角色 ↓': 'More characters ↓', '完整画廊 ↗': 'Full gallery ↗', '会馆里的其他角色': 'More characters from the Hall',
    '名字、能力、经历。': 'A name, abilities, and a story.', '从这里，留下你的角色档案。': 'Start your character’s archive here.',
    '在这一列向下滑，逐页写下角色。': 'Scroll down this column to fill in the profile.',
    '跳过 ↘': 'Skip ↘', '播放': 'Play', '暂停': 'Pause', '重新播放开屏动画': 'Replay intro animation',
    '暂停开屏动画': 'Pause intro animation', '播放开屏动画': 'Play intro animation',
    '开屏动画播放控制': 'Intro playback controls', '开屏配色': 'Intro color theme',
    '会馆原色': 'Hall colors', '靛蓝': 'Indigo', '翠绿': 'Emerald', '金暮': 'Golden dusk', '霓虹紫': 'Neon violet',
    '跳过开屏并前往档案室': 'Skip intro and open the archives', '三列档案': 'Three archives',
    '同人画廊': 'Fan gallery', '会馆米白': 'Ivory theme', '切换为会馆米白背景': 'Switch to the Hall’s ivory background',
    '西木会馆档案室': 'Ximu Hall archive room', '角色画廊 ↗': 'Character gallery ↗',
    '人物关系图 ↗': 'Character relationships ↗', '罗小黑表情包收录 ↗': 'Luo Xiaohei stickers ↗',
    '自定义角色配色海报 ↗': 'Custom character color poster ↗',
    '为角色写下一份档案，让它在会馆里留下名字。': 'Create a character file and give it a place in the Hall.',
    '登录后可收录进会馆名册。': 'Sign in to add this profile to the Hall archive.',
    '登录后可投稿表情包 →': 'Sign in to submit stickers →', '请先登录后管理账户。': 'Sign in to manage your account.',
    '去登录 / 注册': 'Sign in / Register', '用户名': 'Username', '密码': 'Password',
    '忘记密码？回答提示问题找回': 'Forgot your password? Recover it with your security answers.',
    '使用 USSO 账号登录': 'Sign in with USSO', '账号': 'Account', '官方档案': 'Official archive',
    '档案室目录': 'Archive directory', '档案室': 'Archive room', '错误': 'Error', '成功': 'Success',
    '请稍候': 'Please wait', '请输入用户名': 'Enter a username', '请输入密码': 'Enter a password',
    '当前没有公开角色': 'There are no public characters yet', '返回首页': 'Back to home',
    '上一页': 'Previous page', '下一页': 'Next page', '筛选': 'Filter', '排序': 'Sort',
    '全部': 'All', '清空': 'Clear', '未知': 'Unknown', '无': 'None', '中立': 'Neutral',
    '亲近人类': 'Closer to humans', '亲近妖精': 'Closer to spirits', '正在读取': 'Loading',
    '处理中': 'Processing', '上传中': 'Uploading', '上传失败，请重试': 'Upload failed. Please try again.',
    '文件过大': 'File is too large', '图片格式不支持': 'Unsupported image format',
    '编辑成功': 'Updated successfully', '登记成功': 'Registered successfully',
    '确认删除': 'Confirm deletion', '不保存退出': 'Exit without saving', '继续编辑': 'Continue editing'
  };
  var ZH = Object.keys(EN).reduce(function (out, key) { out[EN[key]] = key; return out; }, {});
  var originalText = new WeakMap();
  var lastText = new WeakMap();
  var originalAttrs = new WeakMap();
  var lastAttrs = new WeakMap();
  var observer;
  var language = readLanguage();

  function readLanguage() {
    var match = document.cookie.match(/(?:^|;\s*)iridescently-language=(en|zh-CN)(?:;|$)/);
    try { return match ? match[1] : (localStorage.getItem(COOKIE) === 'en' ? 'en' : 'zh-CN'); }
    catch (_) { return match ? match[1] : 'zh-CN'; }
  }
  function saveLanguage(value) {
    language = value === 'en' ? 'en' : 'zh-CN';
    try { localStorage.setItem(COOKIE, language); } catch (_) {}
    try { document.cookie = COOKIE + '=' + language + '; Domain=.iridescently.xyz; Path=/; Max-Age=31536000; SameSite=Lax; Secure'; } catch (_) {}
    apply(document.head);
    apply(document.body);
    document.documentElement.lang = language;
    document.dispatchEvent(new CustomEvent('iridescently:languagechange', { detail: { language: language } }));
    updateButtons();
  }
  function preserved(node) {
    return node.parentElement && node.parentElement.closest('script,style,noscript,textarea,input,select,option,[contenteditable="true"],[data-user-content],.auth-bar span,.account-entry span,.char-card,.fan-card,.character-card,.home-character,.project-credit__attribution');
  }
  function translateText(node) {
    if (preserved(node)) return;
    if (!originalText.has(node) || (lastText.has(node) && node.nodeValue !== lastText.get(node))) originalText.set(node, node.nodeValue);
    var source = originalText.get(node);
    var trimmed = source.trim();
    var translated = language === 'en' ? (EN[trimmed] || source) : (ZH[trimmed] || source);
    var lead = source.match(/^\s*/)[0], trail = source.match(/\s*$/)[0];
    var next = lead + translated + trail;
    lastText.set(node, next);
    if (node.nodeValue !== next) node.nodeValue = next;
  }
  function translateAttribute(el, name) {
    var value = el.getAttribute(name);
    if (value == null) return;
    var values = originalAttrs.get(el) || {};
    var rendered = lastAttrs.get(el) || {};
    if (!(name in values) || (name in rendered && value !== rendered[name])) values[name] = value;
    originalAttrs.set(el, values);
    var source = values[name].trim();
    var translated = language === 'en' ? (EN[source] || values[name]) : (ZH[source] || values[name]);
    var next = translated;
    rendered[name] = next;
    lastAttrs.set(el, rendered);
    if (value !== next) el.setAttribute(name, next);
  }
  function apply(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) translateText(node);
    if (root.nodeType === 1) translateElement(root);
    root.querySelectorAll && root.querySelectorAll('[title],[aria-label],[aria-description],[placeholder],[alt],input[type="button"],input[type="submit"]').forEach(translateElement);
  }
  function translateElement(el) {
    ['title','aria-label','aria-description','placeholder','alt','value'].forEach(function (name) {
      if (name === 'value' && !/^(button|submit|reset)$/i.test(el.type || '')) return;
      translateAttribute(el, name);
    });
  }
  function updateButtons() {
    document.querySelectorAll('[data-site-language-toggle]').forEach(function (button) {
      button.textContent = language === 'en' ? '中文' : 'EN';
      button.setAttribute('aria-label', language === 'en' ? 'Switch to Simplified Chinese' : '切换到英文');
      button.setAttribute('title', language === 'en' ? 'Switch to Simplified Chinese' : '切换到英文');
      button.setAttribute('aria-pressed', String(language === 'en'));
    });
  }
  function addButton(parent, floating) {
    if (!parent || parent.querySelector('[data-site-language-toggle]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.dataset.siteLanguageToggle = '';
    button.className = floating ? 'site-language-toggle site-language-toggle--floating' : 'site-language-toggle';
    button.addEventListener('click', function () { saveLanguage(language === 'en' ? 'zh-CN' : 'en'); });
    parent.appendChild(button);
    updateButtons();
  }
  function mountButton() {
    var gate = document.querySelector('.gate-language-host');
    var shared = document.querySelector('#qc-nav .qc-right');
    var home = document.querySelector('.site-nav__bottom') || document.querySelector('.site-chrome');
    if (gate) addButton(gate, false);
    else if (shared) addButton(shared, false);
    else if (home) addButton(home, false);
    else if (!document.querySelector('#root')) addButton(document.body, true);
  }
  function mount() {
    mountButton();
    document.documentElement.lang = language;
    apply(document.head);
    apply(document.body);
    if (!observer) {
      observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
          if (record.type === 'childList') {
            record.addedNodes.forEach(function (node) { if (node.nodeType === 1) apply(node); else if (node.nodeType === 3) translateText(node); });
            mountButton();
          }
          else if (record.type === 'attributes') translateElement(record.target);
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title','aria-label','aria-description','placeholder','alt','value'] });
      observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['content','title','aria-label','placeholder'] });
    }
    updateButtons();
  }
  window.IridescentlyLanguage = {
    get: function () { return language; },
    set: saveLanguage,
    t: function (text) { return (language === 'en' ? EN[text] : ZH[text]) || text; }
  };
  var style = document.createElement('style');
  style.textContent = '.site-language-toggle{appearance:none;border:1px solid rgba(245,240,232,.24);border-radius:999px;background:rgba(255,255,255,.06);color:inherit;font:600 11px/1 system-ui,sans-serif;letter-spacing:.04em;padding:7px 9px;min-width:34px;cursor:pointer}.site-language-toggle:hover{background:rgba(255,255,255,.13)}.site-language-toggle:focus-visible{outline:2px solid #ffd783;outline-offset:3px}.site-language-toggle--floating{position:fixed;z-index:10000;top:12px;right:12px;color:#f5f0e8;background:rgba(22,42,36,.88);backdrop-filter:blur(8px)}';
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
