(function accessScopeFilter(global) {
  "use strict";

  const store = global.GardenStore;
  if (!store?.snapshot || !global.PoulpeAccess) return;
  const rawSnapshot = store.snapshot.bind(store);

  store.snapshot = function scopedSnapshot() {
    const data = rawSnapshot();
    const access = global.PoulpeAccess.snapshot();
    if (access.mode !== "client" || !access.parcelId) return data;
    const parcelId = access.parcelId;
    const seedIds = new Set((data.seeds || []).filter((item) => item.parcelId === parcelId).map((item) => item.id));
    return {
      ...data,
      parcels: (data.parcels || []).filter((item) => item.id === parcelId),
      seeds: (data.seeds || []).filter((item) => item.parcelId === parcelId),
      sprouts: (data.sprouts || []).filter((item) => item.parcelId === parcelId || seedIds.has(item.seedId)),
      harvests: (data.harvests || []).filter((item) => item.parcelId === parcelId || seedIds.has(item.seedId)),
      operations: (data.operations || []).filter((item) => item.parcelId === parcelId || seedIds.has(item.seedId)),
      compost: (data.compost || []).filter((item) => item.parcelId === parcelId || seedIds.has(item.seedId)),
      activeParcelId: parcelId,
      activeSeedId: seedIds.has(data.activeSeedId) ? data.activeSeedId : null
    };
  };
})(globalThis);
