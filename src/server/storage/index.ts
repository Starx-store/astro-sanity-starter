import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { attachments } from "@/server/db/schema";

/**
 * طبقة تخزين المرفقات.
 *
 * الوضع الافتراضي (متوافق مع serverless/Vercel): يُخزَّن المحتوى بترميز base64
 * داخل عمود attachments.data — لا يعتمد على نظام ملفات قابل للكتابة.
 * مناسب للملفات الصغيرة (إثباتات التحويل ≤ ~4MB).
 *
 * للتطوير المحلي يمكن تفعيل التخزين على القرص بضبط STORAGE_DRIVER=disk،
 * وتبقى القراءة متوافقة رجعيًا مع المرفقات القديمة المخزّنة على القرص.
 *
 * الوصول للملفات يمر حصريًا عبر /api/files/[id] بعد التحقق من الملكية.
 */

type Attachment = typeof attachments.$inferSelect;

const useDisk = process.env.STORAGE_DRIVER === "disk";

function storageDir(): string {
  return process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.join(process.cwd(), "storage", "uploads");
}

export async function saveAttachment(params: {
  ownerId: string;
  buffer: Buffer;
  mime: string;
  fileName?: string | null;
}): Promise<Attachment> {
  const key = randomUUID();
  let data: string | null = null;

  if (useDisk) {
    const dir = storageDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key), params.buffer);
  } else {
    data = params.buffer.toString("base64");
  }

  const [att] = await db
    .insert(attachments)
    .values({
      ownerId: params.ownerId,
      storageKey: key,
      data,
      fileName: params.fileName ?? null,
      mime: params.mime,
      size: params.buffer.length,
    })
    .returning();
  return att;
}

export async function readAttachment(att: Attachment): Promise<Buffer> {
  // مخزّن في قاعدة البيانات (الوضع الافتراضي/serverless).
  if (att.data) return Buffer.from(att.data, "base64");

  // توافق رجعي: مرفق قديم على القرص.
  const filePath = path.join(storageDir(), att.storageKey);
  if (existsSync(filePath)) return readFile(filePath);

  throw new Error("محتوى المرفق غير متوفّر.");
}
