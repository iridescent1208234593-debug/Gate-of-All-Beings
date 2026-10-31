import test from 'node:test';
import assert from 'node:assert/strict';
import {obstacleFrame} from '../src/graphics.js';
import {OBSTACLES} from '../src/runner.js';

test('obstacle artwork keeps its aspect ratio, full silhouette and ground alignment',()=>{
  for(const source of [[0,0,251,144],[12,24,90,200],[0,0,670,278],[0,0,168,100]]){
    for(const box of Object.values(OBSTACLES)){
      const frame=obstacleFrame(source,box.width,box.height);
      assert.ok(Math.abs(frame.width/frame.height-source[2]/source[3])<1e-9);
      assert.ok(frame.width<=box.width+1e-9&&frame.height<=box.height+1e-9);
      assert.ok(Math.abs(frame.x*2+frame.width-box.width)<1e-9);
      assert.ok(Math.abs(frame.y+frame.height-box.height)<1e-9);
    }
  }
});
