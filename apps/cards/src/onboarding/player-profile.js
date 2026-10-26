/** Per-mount draft only. The application owns account/anonymous persistence. */
export function createPlayerProfile(initial = {}) {
  let profile = { schema_version: 1, display_name: '', species_name: '', avatar_asset_id: '',
    avatar_frame_id: '', avatar_mode: 'default', source_oc_id: '', ...initial };
  let avatarBlob = null;
  let previewUrl = '';
  return {
    getPlayerProfile: () => ({ ...profile }),
    updatePlayerProfile(patch) {
      profile = { ...profile, ...patch, schema_version: 1 };
      profile.display_name = String(profile.display_name || '').trim().slice(0, 60);
      profile.species_name = String(profile.species_name || '').trim().slice(0, 100);
      return { ...profile };
    },
    setAvatarBlob(blob) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      avatarBlob = blob;
      previewUrl = URL.createObjectURL(blob);
      return previewUrl;
    },
    getAvatarBlob: () => profile.avatar_mode === 'upload' ? avatarBlob : null,
    dispose() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      avatarBlob = null;
    },
  };
}
