export function normalizeResearchCollections(value) {
  const source = value && typeof value === 'object' ? value : {};
  const favorites = [...new Set(Array.isArray(source.favorites) ? source.favorites.filter(Boolean).map(String) : [])];
  const seenIds = new Set();
  const lists = (Array.isArray(source.lists) ? source.lists : []).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim().slice(0, 28);
    if (!id || !name || seenIds.has(id)) return [];
    seenIds.add(id);
    return [{
      id,
      name,
      assetIds: [...new Set(Array.isArray(item.assetIds) ? item.assetIds.filter(Boolean).map(String) : [])],
    }];
  });
  return { version: 1, favorites, lists };
}

export function toggleFavorite(state, assetId) {
  const next = normalizeResearchCollections(state);
  next.favorites = next.favorites.includes(assetId)
    ? next.favorites.filter(id => id !== assetId)
    : [assetId, ...next.favorites];
  return next;
}

export function createResearchList(state, name, id) {
  const next = normalizeResearchCollections(state);
  const cleanName = String(name || '').trim().slice(0, 28);
  if (!cleanName || next.lists.some(list => list.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) return next;
  next.lists.push({ id: String(id), name: cleanName, assetIds: [] });
  return next;
}

export function renameResearchList(state, listId, name) {
  const next = normalizeResearchCollections(state);
  const cleanName = String(name || '').trim().slice(0, 28);
  if (!cleanName || next.lists.some(list => list.id !== listId && list.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) return next;
  const list = next.lists.find(item => item.id === listId);
  if (list) list.name = cleanName;
  return next;
}

export function deleteResearchList(state, listId) {
  const next = normalizeResearchCollections(state);
  next.lists = next.lists.filter(list => list.id !== listId);
  return next;
}

export function toggleAssetInResearchList(state, listId, assetId) {
  const next = normalizeResearchCollections(state);
  const list = next.lists.find(item => item.id === listId);
  if (!list) return next;
  list.assetIds = list.assetIds.includes(assetId)
    ? list.assetIds.filter(id => id !== assetId)
    : [...list.assetIds, assetId];
  return next;
}

export function assetsForResearchFilter(state, filterId, allAssetIds) {
  const next = normalizeResearchCollections(state);
  if (filterId === 'favorites') return allAssetIds.filter(id => next.favorites.includes(id));
  const list = next.lists.find(item => item.id === filterId);
  return list ? allAssetIds.filter(id => list.assetIds.includes(id)) : [...allAssetIds];
}
