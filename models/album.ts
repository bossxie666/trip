export type AlbumPhoto = {
  assetId: string; filename: string; sortOrder: number; capturedAt: string;
  isFavorite: boolean; tagIds: string[];
};

export type AlbumDetail = {
  id: string; title: string; description: string | null; tripId: string | null; tripTitle: string | null;
  createdByMemberId: string; coverMediaAssetId: string | null; canEditAlbum: boolean;
  photos: AlbumPhoto[]; tags: { id: string; name: string }[];
  pagination: { filter: string; nextCursor: string | null; total: number; totalPhotos: number; dateCounts: { date: string; count: number }[] };
};
