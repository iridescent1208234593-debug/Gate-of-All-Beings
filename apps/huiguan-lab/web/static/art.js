(function () {
  const $ = id => document.getElementById(id);
  const admin = !!$('entityForm');
  const canvas = $('drawing'), ctx = canvas.getContext('2d');
  let drawing = false, last = null;
  function point(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];
  }
  function stroke(e) {
    const p = point(e); ctx.lineWidth = +$('brush').value; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = $('ink').value; ctx.globalCompositeOperation = $('eraser').checked ? 'destination-out' : 'source-over';
    ctx.beginPath(); ctx.moveTo(...(last || p)); ctx.lineTo(p[0]+.01,p[1]); ctx.stroke(); last=p;
  }
  canvas.onpointerdown = e => { e.preventDefault(); drawing=true; canvas.setPointerCapture(e.pointerId); last=null; stroke(e); };
  canvas.onpointermove = e => { if (drawing) stroke(e); };
  canvas.onpointerup = canvas.onpointercancel = () => { drawing=false; last=null; };
  $('clearDrawing').onclick = () => { if(confirm('清空当前画布？')) ctx.clearRect(0,0,canvas.width,canvas.height); };
  async function upload(file, name) {
    if (!file) return;
    if (file.size > 8*1024*1024) { $('msg').textContent='图片超过 8 MB'; return; }
    $('msg').textContent='上传中…';
    try {
      const headers = {'X-Art-Category':$('cat').value,'X-Art-Name':encodeURIComponent(name)};
      if(admin) headers['X-Lab-Admin']='1';
      const r=await fetch(admin?'/admin/api/art/upload':'/api/art', {method:'POST',credentials:'same-origin',body:file,headers});
      const d=await r.json(); if(!r.ok) throw Error(d.error||r.status);
      $('msg').textContent='已发布到 LAB 素材库';
      if(admin) document.dispatchEvent(new CustomEvent('lab-art-uploaded',{detail:d}));
      else {
        if($('placeNow').checked) {
          const kind=$('cat').value==='plant'?'plant':$('cat').value==='creature'?'creature':'prop';
          const pr=await fetch('/api/art/place',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({asset:d.id,species:name,space:$('space').value,kind,behavior:kind==='creature'?'wander':'idle',height:+$('height').value})});
          const placed=await pr.json(); if(!pr.ok) throw Error('上传成功，放置失败：'+placed.error);
          $('msg').textContent='已上传并放入世界，在线玩家已同步';
        }
        await list();
      }
    } catch(e) { $('msg').textContent=e.message; }
  }
  $('up').onclick = () => { const f=$('file').files[0]; if(f) upload(f,f.name); };
  $('uploadDrawing').onclick = () => canvas.toBlob(blob => upload(blob,'画布-'+new Date().toLocaleTimeString()+'.png'),'image/png');
  async function list() {
    const r=await fetch('/api/art/approved',{credentials:'same-origin'}); if(!r.ok) return;
    const d=await r.json(); $('list').replaceChildren();
    for(const a of d.assets) {
      const tile=document.createElement('div'); tile.className='tile';
      const img=new Image(); img.src='/api/art/file/'+a.id; img.style.cssText='max-width:100%;max-height:120px';
      const label=document.createElement('span'); label.textContent=a.category+' · '+a.filename;
      tile.append(img,label); $('list').append(tile);
    }
  }
  if(!admin) list();
})();
