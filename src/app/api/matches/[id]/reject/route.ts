import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const actor = await participantFromRequest(req);
    if (!actor) return NextResponse.json({ error: "请重新扫码进入" }, { status: 401 });
    if (body.participantId !== actor.id) return NextResponse.json({ error: "无权拒绝" }, { status: 403 });
    const sb = getSupabase();
    const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match) return NextResponse.json({ error: "匹配不存在" }, { status: 404 });
    if (![match.participant_a, match.participant_b].includes(body.participantId)) {
      return NextResponse.json({ error: "你不是该匹配的参与者" }, { status: 403 });
    }
    if (match.status === "rejected") return NextResponse.json({ ok: true });
    if (match.status !== "pending") return NextResponse.json({ error: "当前不可拒绝" }, { status: 409 });
    const { data: rejected } = await sb.from("matches").update({ status: "rejected" }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
    if (!rejected) return NextResponse.json({ error: "匹配状态已改变，请刷新" }, { status: 409 });
    await sb.from("participants").update({ status: "waiting", match_id: null }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "操作失败" }, { status: 500 });
  }
}
