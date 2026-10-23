export const atlasPhotoSlots = ["map_primary", "map_secondary"] as const;
// Existing TEXT relation keys; this requires no database migration.
export const wallPhotoSlots = ["wall_01", "wall_02", "wall_03", "wall_04", "wall_05", "wall_06", "wall_07", "wall_08", "wall_09"] as const;
export type AtlasPhotoSlot = typeof atlasPhotoSlots[number];
export type HomePhotoSlot = AtlasPhotoSlot | typeof wallPhotoSlots[number];
