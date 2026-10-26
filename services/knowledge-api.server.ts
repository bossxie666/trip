import { apiError } from "./api-response";

export function knowledgeMutationError(request: Request, error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (error instanceof SyntaxError) return apiError(request, 400, "INVALID_BODY", "请求内容无效。");
  if (code === "KNOWLEDGE_NOT_FOUND") return apiError(request, 404, code, "知识内容不存在或已删除。");
  const messages: Record<string, string> = {
    INVALID_KNOWLEDGE_ENTRY: "请填写有效的标题和栏目。",
    INVALID_EXTERNAL_URL: "外部链接必须使用有效的 https 地址。",
    INVALID_KNOWLEDGE_MEDIA: "图片无效或尚未上传完成，请重新选择。",
    INVALID_KNOWLEDGE_TAG: "标签不能超过 32 个字。",
  };
  if (messages[code]) return apiError(request, 400, code, messages[code]);
  return apiError(request, 500, "KNOWLEDGE_SAVE_FAILED", "保存失败，请重试。原有内容未更改。");
}
