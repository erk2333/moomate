import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { demoDirectory } from "@/lib/demo-db";

function fileFor(key: string) {
  const dir = join(demoDirectory(), "photos");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, createHash("sha256").update(key).digest("hex") + ".json");
}

export const supabaseStorage = {
  isConfigured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); },
  savePhoto(id: string, data: ArrayBuffer, contentType: string) {
    writeFileSync(fileFor(id), JSON.stringify({ contentType, base64: Buffer.from(data).toString("base64") }), "utf8");
    return `memory:${id}`;
  },
  getPhotoUrl(path: string) {
    const file = fileFor(path.replace(/^memory:/, ""));
    const value = JSON.parse(readFileSync(file, "utf8"));
    return `data:${value.contentType};base64,${value.base64}`;
  },
};
