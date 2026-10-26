import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerProfile } from './player-profile.js';

test('onboarding drafts remain isolated from other players and the input identity', () => {
  const initial = { display_name: '甲', species_name: '人类', avatar_frame_id: 'r02' };
  const first = createPlayerProfile(initial);
  const second = createPlayerProfile({ display_name: '乙' });
  first.updatePlayerProfile({ display_name: '  新名字  ', species_name: '  自定义灵族  ' });
  assert.equal(first.getPlayerProfile().display_name, '新名字');
  assert.equal(first.getPlayerProfile().species_name, '自定义灵族');
  assert.equal(first.getPlayerProfile().avatar_frame_id, 'r02');
  assert.equal(initial.display_name, '甲');
  assert.equal(second.getPlayerProfile().display_name, '乙');
  assert.equal(second.getPlayerProfile().species_name, '');
  const snapshot = first.getPlayerProfile();
  snapshot.species_name = '外部改动';
  assert.equal(first.getPlayerProfile().species_name, '自定义灵族');
  first.dispose(); second.dispose();
});

test('upload Blob stays separate from frame, follows chosen mode and releases previews', () => {
  const profile = createPlayerProfile({ avatar_frame_id: 'r03' });
  const blob = new Blob(['preview'], { type: 'image/webp' });
  const preview = profile.setAvatarBlob(blob);
  profile.updatePlayerProfile({ avatar_mode: 'upload', avatar_asset_id: preview });
  assert.equal(profile.getAvatarBlob(), blob);
  assert.equal(profile.getPlayerProfile().avatar_frame_id, 'r03');
  profile.updatePlayerProfile({ avatar_mode: 'default', avatar_asset_id: '' });
  assert.equal(profile.getAvatarBlob(), null);
  profile.updatePlayerProfile({ avatar_mode: 'upload', avatar_asset_id: preview });
  assert.equal(profile.getAvatarBlob(), blob);
  profile.dispose();
  assert.equal(profile.getAvatarBlob(), null);
});
