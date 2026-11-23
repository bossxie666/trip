export const maxPhotoBytes = 10 * 1024 * 1024;
export function photoSizeLabel(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
}
export function photoFileIssue(file: Pick<File, "size">) {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return { code: "FILE_EMPTY", message: "未读取到照片文件，请重新从手机相册选择。" };
  if (file.size > maxPhotoBytes) return { code: "FILE_TOO_LARGE", message: file.size - maxPhotoBytes < 10486 ? `照片超过 10 MB 上限，超出 ${file.size - maxPhotoBytes} 字节，请选择较小版本。` : `照片实际为 ${photoSizeLabel(file.size)}，超过 10 MB，请选择较小版本。` };
  return null;
}
