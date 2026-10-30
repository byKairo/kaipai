import type { ApiProfile, ApiProfileRoles } from './api-profiles';

/** Activate the saved models belonging to one connection, without copying another connection's IDs. */
export function connectionRoles(profile: ApiProfile): ApiProfileRoles {
  const text = profile.modelConfigs.find(model => model.enabled && model.modelId === profile.models.text && model.capabilities.includes('text'));
  const image = profile.modelConfigs.find(model => model.enabled && model.modelId === profile.models.image && model.capabilities.includes('image-generation'));
  return { textId: profile.models.text ? profile.id : '', imageId: profile.models.image ? profile.id : '', textModelId: text?.id, imageModelId: image?.id };
}

export function saveConnection(profiles: ApiProfile[], profile: ApiProfile) {
  return profiles.some(item => item.id === profile.id) ? profiles.map(item => item.id === profile.id ? profile : item) : [...profiles, profile];
}

/** Saving an inactive connection never changes the active selection. Refresh IDs only for its existing roles. */
export function savedConnectionRoles(roles: ApiProfileRoles, profile: ApiProfile, activate: boolean): ApiProfileRoles {
  const updated = connectionRoles(profile);
  if (activate) return updated;
  return { ...roles,
    ...(roles.textId === profile.id ? { textId: updated.textId, textModelId: updated.textModelId } : {}),
    ...(roles.imageId === profile.id ? { imageId: updated.imageId, imageModelId: updated.imageModelId } : {}),
  };
}
