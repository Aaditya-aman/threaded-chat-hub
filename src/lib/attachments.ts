import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export function validateAttachmentFile(file: File): string | null {
  if (file.size > MAX_BYTES) return "File must be 10MB or smaller";
  if (!ALLOWED.has(file.type)) return "Unsupported file type";
  return null;
}

export async function uploadAttachment(roomId: string, file: File): Promise<{ path: string; attachment_type: string }> {
  const err = validateAttachmentFile(file);
  if (err) throw new Error(err);
  const safe = sanitizeFilename(file.name);
  const path = `${roomId}/${crypto.randomUUID()}_${safe}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return { path, attachment_type: file.type };
}

export function getAttachmentPublicUrl(path: string): string {
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
}

export function isImageMime(type: string | null | undefined): boolean {
  return !!type && type.startsWith("image/");
}
