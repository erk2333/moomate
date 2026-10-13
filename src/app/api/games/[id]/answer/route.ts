import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";
import { chooseCard, CHALLENGES, type ChallengeId } from "@/lib/cards";
import { uploadPhoto } from "@/lib/photo";

type PairDone = { a: boolean; b: boolean };
type GameAnswers = { swapsUsed: number; seenCardIds: string[]; cardDone: { task: PairDone; game: PairDone }; challenges: Record<string, { a?: string; b?: string; photoPath?: string; confirmedA?: boolean; confirmedB?: boolean }>; summary: { a: string; b: string } };
function failure(error: string, status: number) { return NextResponse.json({ error }, { status }); }

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const actor = await participantFromRequest(req);
    if (!actor) return failure("请重新扫码进入", 401);
    const form = await req.formData();
    if (String(form.get("participantId") || "") !== actor.id) return failure("无权操作", 403);
    const action = String(form.get("action") || "");
    const slot = String(form.get("slot") || "");
    const challengeId = String(form.get("challengeId") || "") as ChallengeId;
    const text = String(form.get("text") || "").trim().slice(0, 300);
    const photo = form.get("photo") as File | null;
    const sb = getSupabase();
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: game } = await sb.from("games").select("*").eq("id", id).maybeSingle();
      if (!game) return failure("游戏不存在", 404);
      const { data: match } = await sb.from("matches").select("participant_a,participant_b,status,room_id").eq("id", game.match_id).maybeSingle();
      if (!match || ![match.participant_a, match.participant_b].includes(actor.id)) return failure("无权操作", 403);
      if (match.status !== "confirmed" || game.status !== "active") return failure("当前游戏不可修改", 409);
      const side: "a" | "b" = actor.id === match.participant_a ? "a" : "b";
      const q = structuredClone(game.questions) as { cards: Array<{ id: string; title: string; text: string; detail?: string[] }>; challengeIds: ChallengeId[] };
      const oldAnswers = game.answers;
      const a = structuredClone(oldAnswers) as GameAnswers;
      if (!q?.cards || !q.challengeIds || !a?.cardDone) return failure("游戏数据格式错误", 500);
      const taskDone = a.cardDone.task.a && a.cardDone.task.b;
      const gameDone = a.cardDone.game.a && a.cardDone.game.b;
      const currentSlot = !taskDone ? "task" : !gameDone ? "game" : null;
      if (action === "swap_card") {
        if (slot !== currentSlot) return failure("当前不能换这张卡", 409);
        if (a.swapsUsed >= 20) return failure("20 次换卡机会已用完", 409);
        if (a.cardDone[slot as "task" | "game"].a || a.cardDone[slot as "task" | "game"].b) return failure("已有人完成，不能再换卡", 409);
        const index = slot === "task" ? 0 : 1;
        const { data: people } = await sb.from("participants").select("tags").in("id", [match.participant_a, match.participant_b]);
        const tags = (people || []).flatMap((p: { tags: string[] }) => p.tags || []);
        q.cards[index] = chooseCard(slot as "task" | "game", tags, q.cards[index].id);
        a.swapsUsed++;
        a.seenCardIds.push(q.cards[index].id);
      } else if (action === "confirm_card") {
        if (slot !== currentSlot) return failure("请按顺序完成卡片", 409);
        a.cardDone[slot as "task" | "game"][side] = true;
      } else if (action === "challenge_answer") {
        if (!gameDone) return failure("请先完成两张线下卡", 409);
        if (!q.challengeIds.includes(challengeId)) return failure("未抽到该挑战", 400);
        const index = q.challengeIds.indexOf(challengeId);
        const isDone = (key: ChallengeId) => {
          const v = a.challenges[key];
          return key === "C2" ? Boolean(v?.photoPath && v.confirmedA && v.confirmedB) : Boolean(v?.a && v?.b);
        };
        if (q.challengeIds.slice(0, index).some(key => !isDone(key))) return failure("请按顺序完成挑战", 409);
        const cur = a.challenges[challengeId] || {};
        if (CHALLENGES[challengeId].type === "photo") {
          if (photo) {
            if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return failure("仅支持 JPG、PNG 或 WebP", 400);
            if (photo.size > 8 * 1024 * 1024) return failure("照片不能超过 8MB", 413);
            if (cur.photoPath) return failure("本关合照已上传", 409);
            cur.photoPath = await uploadPhoto(match.room_id, `${id}-${challengeId}`, await photo.arrayBuffer(), photo.type);
          }
          if (String(form.get("confirm") || "") === "1") {
            if (!cur.photoPath) return failure("请先上传双方同意的合照", 400);
            if (side === "a") cur.confirmedA = true; else cur.confirmedB = true;
          }
          if (!photo && String(form.get("confirm") || "") !== "1") return failure("请上传或确认合照", 400);
        } else {
          if (!text) return failure("请填写一句话", 400);
          cur[side] = text;
        }
        a.challenges[challengeId] = cur;
      } else if (action === "summary") {
        if (!gameDone || q.challengeIds.some(key => {
          const v = a.challenges[key];
          return key === "C2" ? !(v?.photoPath && v.confirmedA && v.confirmedB) : !(v?.a && v?.b);
        })) return failure("请先完成两关挑战", 409);
        if (!text) return failure("请填写一句今晚总结", 400);
        a.summary[side] = text;
      } else return failure("未知操作", 400);
      const { data: updated, error } = await sb.from("games").update({ questions: q, answers: a }).eq("id", id).eq("status", "active").eq("answers", JSON.stringify(oldAnswers)).select().maybeSingle();
      if (error) throw new Error(error.message);
      if (updated) return NextResponse.json({ game: updated });
    }
    return failure("两人同时操作，请重试", 409);
  } catch (err) {
    return failure(err instanceof Error ? err.message : "提交失败", 500);
  }
}
