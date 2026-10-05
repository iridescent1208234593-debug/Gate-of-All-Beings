import http from 'node:http';
// Retain old bookmarks while running only one card game.
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const hash=/collection|codex|worldview/.test(pathname)?'#world':'#home';
  res.writeHead(308,{Location:`https://zszm.iridescently.xyz/${hash}`,'Cache-Control':'no-store'});
  res.end('众生之门已合并至 zszm.iridescently.xyz');
});
server.listen(Number(process.env.PORT||5176),'127.0.0.1');
