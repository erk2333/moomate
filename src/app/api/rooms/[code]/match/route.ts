import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { genderCompatible, scorePairDetails } from "@/lib/match";
import { validAnswers } from "@/lib/quiz";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
    if (!room || room.status === "ended") return NextResponse.json({ error: "房间不存在" }, { status: 404 });
    if (body.hostToken !== room.host_token) return NextResponse.json({ error: "无主理人权限" }, { status: 403 });

    const { data: people } = await sb.from("participants").select("*").eq("room_id", room.id);
    const pool = (people || []).filter((p: any) => !p.match_id && p.status === "waiting" && validAnswers(p.answers)).sort((a: any, b: any) => a.id.localeCompare(b.id));
    if (pool.length < 2) return NextResponse.json({ error: "可匹配人数不足" }, { status: 400 });

    const { data: rejected } = await sb.from("matches").select("participant_a,participant_b").eq("room_id", room.id).eq("status", "rejected");
    const pairKey = (a: string, b: string) => [a, b].sort().join("|");
    const blocked = new Set((rejected || []).map((m: any) => pairKey(m.participant_a, m.participant_b)));
    const used = new Set<string>();
    const pairs: Array<{ a: any; b: any; score: number; reason: string }> = [];
    while (true) {
      let best: { a: any; b: any; score: number; reason: string } | null = null;
      for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i], b = pool[j];
        if (used.has(a.id) || used.has(b.id) || blocked.has(pairKey(a.id, b.id))) continue;
        if (!genderCompatible(a.gender, b.gender, a.gender_preference, b.gender_preference)) continue;
        const details = scorePairDetails(a.answers, b.answers);
        if (!best || details.score > best.score || (details.score === best.score && pairKey(a.id, b.id) < pairKey(best.a.id, best.b.id))) best = { a, b, score: details.score, reason: details.reason };
      }
      if (!best) break;
      used.add(best.a.id); used.add(best.b.id); pairs.push(best);
    }

    if (pairs.length === 0) return NextResponse.json({ error: "没有满足偏好的可配对组合" }, { status: 400 });

    const results = [];
    for (const pair of pairs) {
      const { data: match } = await sb
        .from("matches")
        .insert({
          room_id: room.id,
          participant_a: pair.a.id,
          participant_b: pair.b.id,
          score: pair.score,
          reason: pair.reason,
        })
        .select()
        .single();
      await sb.from("participants").update({ status: "matched", match_id: match.id }).in("id", [pair.a.id, pair.b.id]);
      results.push(match);
    }
    return NextResponse.json({ matches: results, unmatched: pool.length - used.size });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "匹配失败" }, { status: 500 });
  }
}
