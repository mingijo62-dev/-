export const FILE_MAX = 4 * 1024 * 1024; // Vercel 요청 본문 한도(4.5MB) 고려
export const FILE_EXT = ["pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx", "hwp", "hwpx", "txt", "png", "jpg", "jpeg", "gif", "zip"];

const MIME: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", txt: "text/plain; charset=utf-8",
  webp: "image/webp", svg: "image/svg+xml",
};
export function mimeOf(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}
export function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
