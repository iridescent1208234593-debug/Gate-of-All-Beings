// Classic script: unlike ES modules, this can explain a double-clicked file:// page.
if(location.protocol==='file:'){
  document.getElementById('oc-status').textContent='当前是直接打开的本地文件，无法启动游戏或读取 OC。请先运行下方的本地试玩命令，再打开 http://127.0.0.1:5186/。';
  const help=document.createElement('pre');
  help.textContent='在 Gate-of-All-Beings 仓库目录打开 PowerShell，执行：\n\nnode apps/mini-games/dev.mjs\n\n本地试玩提供测试 OC；读取真实 OC 需要另行接入登录后端。';
  help.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;margin:20px 0;padding:16px;background:#f1e3ce;color:#67483e';
  document.getElementById('oc-status').after(help);
}
