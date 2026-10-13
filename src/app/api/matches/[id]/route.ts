import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const actor = await participantFromRequest(req);
    if (!actor) return NextResponse.json({ error: "请重新扫码进入" }, { status: 401 });
    const sb = getSupabase();
    const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match) return NextResponse.json({ error: "匹配不存在" }, { status: 404 });
    if (![match.participant_a, match.participant_b].includes(actor.id)) return NextResponse.json({ error: "无权查看" }, { status: 403 });
    const { data: participants } = await sb
      .from("participants").select("id,nickname,avatar,tags,photo_uploaded,status")
      .in("id", [match.participant_a, match.participant_b]);
    const { data: games } = await sb.from("games").select("*").eq("match_id", id);
    return NextResponse.json({ match, participants, game: games?.[0] || null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "查询失败" }, { status: 500 });
  }
}
