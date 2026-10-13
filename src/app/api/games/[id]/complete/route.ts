import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";
import { type ChallengeId } from "@/lib/cards";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const actor = await participantFromRequest(req);
    if (!actor) return NextResponse.json({ error: "请重新扫码进入" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.participantId !== actor.id) return NextResponse.json({ error: "无权操作" }, { status: 403 });
    const sb = getSupabase();
    const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
    if (!game) return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
    const { data: match } = await sb.from("matches").select("*").eq("id", game.match_id).maybeSingle();
    if (!match || ![match.participant_a, match.participant_b].includes(actor.id)) return NextResponse.json({ error: "无权操作" }, { status: 403 });
    if (game.status === "completed" && game.card) return NextResponse.json({ game });
    if (match.status !== "confirmed") return NextResponse.json({ error: "匹配尚未确认" }, { status: 409 });
    const q = game.questions as { cards: Array<{ id: string; title: string; text: string }>; challengeIds: ChallengeId[] };
    const a = game.answers as { cardDone?: { task: { a: boolean; b: boolean }; game: { a: boolean; b: boolean } }; challenges?: Record<string, { a?: string; b?: string; photoPath?: string; confirmedA?: boolean; confirmedB?: boolean }>; summary?: { a?: string; b?: string } };
    if (!a.cardDone?.task.a || !a.cardDone.task.b || !a.cardDone.game.a || !a.cardDone.game.b) return NextResponse.json({ error: "两张卡尚未由双方确认完成" }, { status: 400 });
    for (const key of q.challengeIds) {
      const result = a.challenges?.[key];
      const done = key === "C2" ? Boolean(result?.photoPath && result.confirmedA && result.confirmedB) : Boolean(result?.a && result?.b);
      if (!done) return NextResponse.json({ error: `挑战 ${key} 尚未完成` }, { status: 400 });
    }
    if (!a.summary?.a || !a.summary?.b) return NextResponse.json({ error: "请双方各写一句今晚总结" }, { status: 400 });
    const { data: people } = await sb.from("participants").select("id,nickname,photo_uploaded").in("id", [match.participant_a, match.participant_b]);
    const nameA = people?.find((p: { id: string }) => p.id === match.participant_a)?.nickname || "参与者 A";
    const nameB = people?.find((p: { id: string }) => p.id === match.participant_b)?.nickname || "参与者 B";
    const card = { title: `${nameA} × ${nameB}`, participants: [{ id: match.participant_a, nickname: nameA }, { id: match.participant_b, nickname: nameB }], cards: q.cards.map(c => ({ id: c.id, title: c.title, status: "双方确认完成" })), challenges: q.challengeIds.map(key => ({ id: key, result: a.challenges?.[key] })), summary: a.summary, completedAt: new Date().toISOString() };
    const { data: updated, error } = await sb.from("games").update({ status: "completed", card }).eq("id", id).eq("status", "active").select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) {
      const { data: latest } = await sb.from("games").select("*").eq("id", id).single();
      return NextResponse.json({ game: latest });
    }
    await sb.from("matches").update({ status: "completed" }).eq("id", match.id);
    await sb.from("participants").update({ status: "completed" }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ game: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "生成失败" }, { status: 500 });
  }
}
