export const MAX_RESUME_SIZE = 5 * 1024 * 1024;
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function validateResumeUpload(file: { name: string; type: string; size: number }) {
  const extension = file.name.toLowerCase().match(/\.(pdf|docx)$/)?.[0];
  if (file.size > MAX_RESUME_SIZE) throw new Error("O arquivo excede o limite de 5 MB.");
  if (!extension || !["application/pdf", DOCX_MIME, "application/octet-stream"].includes(file.type || "application/octet-stream")) {
    throw new Error("Envie somente PDF ou DOCX.");
  }
  return extension;
}
