import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import { demoTokenSecret } from "@/lib/demo-db";

function secret() {
  return process.env.PARTICIPANT_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || demoTokenSecret();
}

export function issueParticipantToken(id: string, roomId: string, expiresAt: string): string {
  const payload = Buffer.from(JSON.stringify({ id, roomId, exp: new Date(expiresAt).getTime() })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function tokenIdentity(req: Request): { id: string; roomId: string } | null {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let provided: Buffer;
  try { provided = Buffer.from(sig, "base64url"); } catch { return null; }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof value.id !== "string" || typeof value.roomId !== "string" || !Number.isFinite(value.exp) || value.exp < Date.now()) return null;
    return { id: value.id, roomId: value.roomId };
  } catch { return null; }
}

export async function participantFromRequest(req: Request) {
  const identity = tokenIdentity(req);
  if (!identity) return null;
  const { data } = await getSupabase().from("participants").select("*").eq("id", identity.id).eq("room_id", identity.roomId).maybeSingle();
  return data || null;
}
