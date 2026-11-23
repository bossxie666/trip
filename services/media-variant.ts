export const mediaVariants = { thumb: { width: 480, quality: 76 }, card: { width: 960, quality: 82 }, display: { width: 1600, quality: 84 } } as const;
export function mediaVariantKey(objectKey: string, variant: keyof typeof mediaVariants) {
  return `${objectKey}.v1-${variant}.webp`;
}
export function mediaStorageKeys(objectKey: string) {
  return [objectKey, ...Object.keys(mediaVariants).map(variant => mediaVariantKey(objectKey, variant as keyof typeof mediaVariants))];
}
