/* Saved HEX values are the character's source colors, never theme indices. */
(function () {
  'use strict';
  const valid = value => /^#[0-9a-f]{6}$/i.test(value || '');
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const hex = values => '#' + values.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, amount) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * amount));
  const luminance = value => rgb(value).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  function textFor(backgrounds) {
    const score = color => Math.min(...backgrounds.map(background => contrast(color, background)));
    return score('#ffffff') >= score('#161823') ? '#ffffff' : '#161823';
  }
  const COLOR_SCHEMES = [
  { name: '罗小黑·漆黑×翠绿', primary: '#1A1F2E', primaryDark: '#10131C', accent: '#0EB83A', accentLight: '#86DB9C', accentPale: '#B6E9C3', text: '#DFDBD8', dim: '#72707D', line: 'rgba(14,184,58,0.25)' },
  { name: '无限·靛蓝×银白', primary: '#065279', primaryDark: '#03324B', accent: '#D1D9E0', accentLight: '#E8ECEF', accentPale: '#F1F3F5', text: '#DCE3E4', dim: '#678CA6', line: 'rgba(209,217,224,0.25)' },
  { name: '鹿野·黛蓝×缟白', primary: '#3B3561', primaryDark: '#242042', accent: '#F0EFEB', accentLight: '#F6F5F2', accentPale: '#FBFAF8', text: '#E6E4F0', dim: '#8B87A6', line: 'rgba(240,239,235,0.25)' },
  { name: '哪吒·品红×橙黄', primary: '#8B1942', primaryDark: '#560F28', accent: '#FFA400', accentLight: '#FFD17F', accentPale: '#FFE3B2', text: '#F0DADB', dim: '#B06C88', line: 'rgba(255,164,0,0.25)' },
  { name: '三足乌馆长·暮紫×金橙', primary: '#4a1033', primaryDark: '#170a14', accent: '#e8a33d', accentLight: '#f5c26b', accentPale: '#ffd9a0', text: '#f3e6e0', dim: '#b99aa9', line: 'rgba(232,163,61,0.25)' },
  { name: '深绿×暖黄', primary: '#1b4d3e', primaryDark: '#103428', accent: '#e8c050', accentLight: '#f0d878', accentPale: '#f8e8a8', text: '#e4efe0', dim: '#8a9e80', line: 'rgba(232,192,80,0.25)' },
  { name: '黛蓝×缃色', primary: '#425066', primaryDark: '#27303d', accent: '#F0C239', accentLight: '#f7e09c', accentPale: '#faecc3', text: '#e5e3e1', dim: '#888b9c', line: 'rgba(240,194,57,0.25)' },
  { name: '绛紫×月白', primary: '#8C4356', primaryDark: '#542833', accent: '#D6ECF0', accentLight: '#eaf5f7', accentPale: '#f2f9fa', text: '#f1e1de', dim: '#b18393', line: 'rgba(214,236,240,0.25)' },
  { name: '鸦青×酡颜', primary: '#424C50', primaryDark: '#272d30', accent: '#F9906F', accentLight: '#fcc7b7', accentPale: '#fdddd3', text: '#e5e2de', dim: '#888890', line: 'rgba(249,144,111,0.25)' },
  { name: '玄青×赤金', primary: '#3D3B4F', primaryDark: '#24232f', accent: '#F2BE45', accentLight: '#f8dea2', accentPale: '#fbebc7', text: '#e5dfdd', dim: '#857f8f', line: 'rgba(242,190,69,0.25)' },
  { name: '黛绿×珊瑚赫', primary: '#2F4A4A', primaryDark: '#1D2D2D', accent: '#C12C1F', accentLight: '#e0958f', accentPale: '#ecbfbb', text: '#e3e2dd', dim: '#7d878c', line: 'rgba(193,44,31,0.25)' },
  { name: '紫檀×松花', primary: '#4C221B', primaryDark: '#2d1410', accent: '#FFEE6F', accentLight: '#fff6b7', accentPale: '#fff9d3', text: '#e7dcd6', dim: '#8d7172', line: 'rgba(255,238,111,0.25)' },
  { name: '苍色×茶色', primary: '#55666A', primaryDark: '#343F41', accent: '#B35C44', accentLight: '#d9ada1', accentPale: '#e8cec6', text: '#e8e6e1', dim: '#92979e', line: 'rgba(179,92,68,0.25)' },
  { name: '漆黑×牙色', primary: '#161823', primaryDark: '#0d0e15', accent: '#EEDEB0', accentLight: '#f6eed7', accentPale: '#f9f5e7', text: '#dfdad7', dim: '#706c77', line: 'rgba(238,222,176,0.25)' },
  { name: '靛蓝×藕荷色', primary: '#065279', primaryDark: '#033148', accent: '#E4C6D0', accentLight: '#f1e2e7', accentPale: '#f6edf0', text: '#dce3e4', dim: '#678ca6', line: 'rgba(228,198,208,0.25)' },
  { name: '黧×樱草色', primary: '#5D513C', primaryDark: '#373024', accent: '#EAFF56', accentLight: '#f4ffaa', accentPale: '#f8ffcc', text: '#e9e3db', dim: '#978b85', line: 'rgba(234,255,86,0.25)' },
  { name: '水绿×葱青', primary: '#D4F2E7', primaryDark: '#7f918a', accent: '#3E6E4E', accentLight: '#9eb6a6', accentPale: '#c3d3ca', text: '#2a3a2e', dim: '#6e8a78', line: 'rgba(62,110,78,0.25)' },
  { name: '苍黄×丁香色', primary: '#2E5C48', primaryDark: '#1C392C', accent: '#CCA4E3', accentLight: '#e5d1f1', accentPale: '#efe3f6', text: '#e2e4dc', dim: '#7d918b', line: 'rgba(204,164,227,0.25)' },
  { name: '众生之门·霓虹紫', primary: '#2A1A33', primaryDark: '#170E1F', accent: '#D0A9DA', accentLight: '#E8C8F0', accentPale: '#F3E2F8', text: '#EDE4F2', dim: '#8F7F9C', line: 'rgba(173,113,187,0.25)' }
];
  function build(primary, accent) {
    if (!valid(primary) || !valid(accent)) throw new Error('颜色格式需为 #RRGGBB');
    primary = primary.toLowerCase(); accent = accent.toLowerCase();
    const background = mix(primary, '#000000', .4);
    const text = textFor([primary, background]);
    return {
      primary, primaryDark: background, accent,
      accentLight: mix(accent, '#ffffff', .5), accentPale: mix(accent, '#ffffff', .7),
      text, dim: text, line: 'rgba(' + rgb(accent).join(',') + ',0.25)'
    };
  }
  function resolve(data, presets = COLOR_SCHEMES) {
    if (valid(data && data.colorPrimary) && valid(data && data.colorAccent)) {
      const match = (presets || []).find(theme => theme.primary.toLowerCase() === data.colorPrimary.toLowerCase() && theme.accent.toLowerCase() === data.colorAccent.toLowerCase());
      return match ? { ...match } : build(data.colorPrimary, data.colorAccent);
    }
    return (presets || [])[data && data.colorIndex] || (presets || [])[4];
  }
  function tokens(theme) {
    const text = textFor([theme.primary, theme.primaryDark]);
    const button = textFor([theme.accent]);
    return {
      '--character-primary': theme.primary, '--character-accent': theme.accent,
      '--bg': theme.primaryDark, '--surface': theme.primary, '--surface-hover': theme.primary,
      '--paper': theme.primaryDark, '--ink': text, '--text': text, '--dim': text, '--text-dim': text,
      '--accent': theme.accent, '--accent2': theme.accentLight, '--green': theme.accentLight,
      '--gold': theme.accentLight, '--gold-dim': text, '--btn-text': button,
      '--border': theme.line, '--line': theme.line, '--outline': text
    };
  }
  function installShowcase(data) {
    const theme = resolve(data);
    if (!theme) return;
    const root = document.documentElement;
    const existing = getComputedStyle(root);
    // Matching snapshots may retain the preset's deliberately chosen dark background.
    if (existing.getPropertyValue('--character-primary').trim().toLowerCase() === theme.primary.toLowerCase() && valid(existing.getPropertyValue('--bg').trim())) theme.primaryDark = existing.getPropertyValue('--bg').trim();
    const css = Object.entries(tokens(theme)).map(([key, value]) => key + ':' + value).join(';');
    const style = document.createElement('style');
    style.id = 'character-color-truth';
    style.textContent = ':root:not([data-theme="cream"]){' + css + '}';
    document.head.appendChild(style);
  }
  window.HuiguanColors = { valid, build, resolve, tokens, installShowcase, presets: COLOR_SCHEMES };
})();
