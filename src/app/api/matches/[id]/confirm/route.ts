import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const actor = await participantFromRequest(req);
    if (!actor) return NextResponse.json({ error: "请重新扫码进入" }, { status: 401 });
    if (body.participantId !== actor.id) return NextResponse.json({ error: "无权确认" }, { status: 403 });
    const sb = getSupabase();
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
      if (!match) return NextResponse.json({ error: "匹配不存在" }, { status: 404 });
      const isA = actor.id === match.participant_a;
      const isB = actor.id === match.participant_b;
      if (!isA && !isB) return NextResponse.json({ error: "你不是该匹配的参与者" }, { status: 403 });
      if (match.status === "rejected" || match.status === "completed") return NextResponse.json({ error: "该匹配已结束" }, { status: 409 });
      if (match.status === "confirmed") return NextResponse.json({ match });
      const confirmedA = isA || match.confirmed_a;
      const confirmedB = isB || match.confirmed_b;
      const { data, error } = await sb.from("matches").update({ confirmed_a: confirmedA, confirmed_b: confirmedB, status: confirmedA && confirmedB ? "confirmed" : "pending" })
        .eq("id", id).eq("status", "pending").eq("confirmed_a", match.confirmed_a).eq("confirmed_b", match.confirmed_b).select().maybeSingle();
      if (error) throw new Error(error.message);
      if (data) {
        if (data.status === "confirmed") await sb.from("participants").update({ status: "confirmed" }).in("id", [match.participant_a, match.participant_b]);
        return NextResponse.json({ match: data });
      }
    }
    return NextResponse.json({ error: "双方同时操作，请重试" }, { status: 409 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "确认失败" }, { status: 500 });
  }
}
