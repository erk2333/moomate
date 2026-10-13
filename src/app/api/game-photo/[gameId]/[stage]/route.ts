import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";
import { createSignedUrl } from "@/lib/photo";

export async function GET(req: Request, ctx: { params: Promise<{ gameId: string; stage: string }> }) {
  try {
    const { gameId, stage } = await ctx.params;
    const actor = await participantFromRequest(req);
    if (!actor) return NextResponse.json({ error: "请重新扫码进入" }, { status: 401 });
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("match_id,answers").eq("id", gameId).maybeSingle();
    if (!game) return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("participant_a,participant_b,status").eq("id", game.match_id).maybeSingle();
    if (!match || ![match.participant_a, match.participant_b].includes(actor.id) || !["confirmed", "completed"].includes(match.status)) return NextResponse.json({ error: "无权查看" }, { status: 403 });
    if (stage !== "C2") return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    const path = game.answers?.challenges?.C2?.photoPath;
    if (!path) return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    return NextResponse.json({ url: await createSignedUrl(path) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "获取失败" }, { status: 500 });
  }
}
