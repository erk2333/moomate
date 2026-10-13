import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";
import { chooseCard, chooseChallenges } from "@/lib/cards";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const actor = await participantFromRequest(req);
    if (!actor) return NextResponse.json({ error: "请重新扫码进入" }, { status: 401 });
    const sb = getSupabase();
    const { data: match } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (!match || ![match.participant_a, match.participant_b].includes(actor.id)) return NextResponse.json({ error: "无权开始" }, { status: 403 });
    if (!["confirmed", "completed"].includes(match.status)) return NextResponse.json({ error: "匹配尚未双方确认" }, { status: 400 });
    const { data: existing } = await sb.from("games").select("*").eq("match_id", id).maybeSingle();
    if (existing) return NextResponse.json({ game: existing });
    const { data: people } = await sb.from("participants").select("tags").in("id", [match.participant_a, match.participant_b]);
    const tags = (people || []).flatMap((p: { tags: string[] }) => p.tags || []);
    const questions = { cards: [chooseCard("task", tags), chooseCard("game", tags)], challengeIds: chooseChallenges() };
    const answers = { swapsUsed: 0, seenCardIds: questions.cards.map(c => c.id), cardDone: { task: { a: false, b: false }, game: { a: false, b: false } }, challenges: {}, summary: { a: "", b: "" } };
    const { data: game, error } = await sb.from("games").insert({ match_id: id, type: "线下双人卡片", questions, answers }).select().single();
    if (error) throw new Error(error.message);
    await sb.from("participants").update({ status: "playing" }).in("id", [match.participant_a, match.participant_b]);
    return NextResponse.json({ game });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "创建游戏失败" }, { status: 500 });
  }
}
