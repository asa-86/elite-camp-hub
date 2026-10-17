// File service abstraction. Material files are NOT stored in Supabase Storage;
// they go to an external host configured with VITE_FILE_SERVICE_URL.
// The real host must expose a small authenticated API (see docs/FILE_SERVICE.md):
//   POST   {base}/files            multipart(file, scope)  -> { key }
//   GET    {base}/files/{key}/url  -> { url }  (short-lived signed URL, permission-checked)
//   DELETE {base}/files/{key}
import { config } from "./config";
import type { FileRef } from "@/lib/types";

export const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/zip": "ZIP",
  "image/png": "تصویر",
  "image/jpeg": "تصویر",
};

export class FileError extends Error {}

export function validateFile(file: File) {
  if (!ALLOWED_MIME[file.type]) throw new FileError("نوع فایل مجاز نیست. فقط PDF، Word، PowerPoint، ZIP و تصویر.");
  if (file.size > config.fileMaxMb * 1024 * 1024)
    throw new FileError(`حجم فایل بیش از ${config.fileMaxMb} مگابایت است.`);
  if (file.size === 0) throw new FileError("فایل خالی است.");
}

export interface FileAdapter {
  readonly mode: "demo" | "remote";
  upload(file: File, scope: string, token?: string): Promise<FileRef>;
  getUrl(key: string, token?: string): Promise<string>;
  remove(key: string, token?: string): Promise<void>;
}

// Demo adapter: keeps blobs in memory only (lost on reload). Never pretends to be a real host.
const memory = new Map<string, Blob>();
const demoAdapter: FileAdapter = {
  mode: "demo",
  async upload(file, scope) {
    validateFile(file);
    const key = `${scope}/${crypto.randomUUID()}`;
    memory.set(key, file);
    return { key, originalName: file.name, mime: file.type, size: file.size };
  },
  async getUrl(key) {
    const blob = memory.get(key);
    if (!blob) throw new FileError("این فایل نمونه است و در حالت آزمایشی محتوای واقعی ندارد.");
    return URL.createObjectURL(blob);
  },
  async remove(key) {
    memory.delete(key);
  },
};

function remoteAdapter(base: string): FileAdapter {
  const req = async (path: string, init: RequestInit, token?: string) => {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        ...init,
        headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch {
      throw new FileError("ارتباط با سرور فایل برقرار نشد. لطفاً دوباره تلاش کنید.");
    }
    if (res.status === 403) throw new FileError("اجازه دسترسی به این فایل را ندارید.");
    if (!res.ok) throw new FileError("خطا در سرور فایل.");
    return res;
  };
  return {
    mode: "remote",
    async upload(file, scope, token) {
      validateFile(file);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("scope", scope);
      const res = await req("/files", { method: "POST", body: fd }, token);
      const { key } = (await res.json()) as { key: string };
      return { key, originalName: file.name, mime: file.type, size: file.size };
    },
    async getUrl(key, token) {
      const res = await req(`/files/${encodeURIComponent(key)}/url`, { method: "GET" }, token);
      return ((await res.json()) as { url: string }).url;
    },
    async remove(key, token) {
      await req(`/files/${encodeURIComponent(key)}`, { method: "DELETE" }, token);
    },
  };
}

export const files: FileAdapter = config.fileServiceUrl ? remoteAdapter(config.fileServiceUrl) : demoAdapter;
