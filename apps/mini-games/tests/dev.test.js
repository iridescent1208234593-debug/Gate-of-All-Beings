import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDemoServer } from '../dev.mjs';

test('manual playground serves runnable source and clearly labelled synthetic OCs only',async()=>{
  const server=createDemoServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    const html=await(await fetch(origin+'/')).text();
    assert.match(html,/__demo\/banner.js/);assert.match(html,/file-mode.js/);
    const identity=await(await fetch(origin+'/api/gate/identity')).json();
    assert.equal(identity.owner.user_id,'mini-games-demo');
    const {ocs}=await(await fetch(origin+'/api/gate/ocs')).json();
    assert.equal(ocs.length,2);assert.ok(ocs.every(oc=>oc.name.startsWith('测试 OC')));
    const image=await fetch(origin+ocs[0].avatar_url);assert.equal(image.headers.get('content-type'),'image/svg+xml');
    for(const file of ['/src/app.js','/src/maps.js','/shared/site-domains/index.mjs','/shared/shared-session/kv.js'])assert.equal((await fetch(origin+file)).status,200);
    assert.equal((await fetch(origin+'/dev.mjs')).status,404);
    assert.equal((await fetch(origin+'/shared/shared-session/game.js')).status,404);
    assert.equal((await fetch(origin+'/api/gate/ocs',{method:'POST',body:'{}'})).status,405);
    await new Promise((resolve,reject)=>{
      const request=http.get(origin,{headers:{Host:'untrusted.test'}},response=>{try{assert.equal(response.statusCode,421);response.resume();resolve();}catch(error){reject(error);}});request.on('error',reject);
    });
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
