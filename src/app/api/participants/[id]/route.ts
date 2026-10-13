import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const actor = await participantFromRequest(req);
    if (!actor) return NextResponse.json({ error: "请重新扫码进入" }, { status: 401 });
    if (actor.id !== id) return NextResponse.json({ error: "无权查看" }, { status: 403 });
    const sb = getSupabase();
    const { data } = await sb.from("participants").select("id,room_id,nickname,avatar,gender,gender_preference,tags,photo_uploaded,status,match_id,answers,ai_profile").eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ error: "不存在" }, { status: 404 });
    return NextResponse.json({ participant: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "失败" }, { status: 500 });
  }
}
