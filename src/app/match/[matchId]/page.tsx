"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authHeaders } from "@/lib/client-auth";
import { CHALLENGES, type ChallengeId } from "@/lib/cards";

type Match = { id: string; participant_a: string; participant_b: string; status: string; reason: string; confirmed_a: boolean; confirmed_b: boolean };
type Participant = { id: string; nickname: string; tags: string[]; photo_uploaded: boolean };
type Game = { id: string; status: string; questions: { cards: Array<{ id: string; title: string; text: string; detail?: string[] }>; challengeIds: ChallengeId[] }; answers: { swapsUsed: number; cardDone: { task: { a: boolean; b: boolean }; game: { a: boolean; b: boolean } }; challenges: Record<string, { a?: string; b?: string; photoPath?: string; confirmedA?: boolean; confirmedB?: boolean }>; summary: { a: string; b: string } }; card?: { title: string; cards: Array<{ id: string; title: string; status: string }>; challenges: Array<{ id: ChallengeId; result: { a?: string; b?: string; photoPath?: string } }>; summary: { a: string; b: string }; completedAt: string } };

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [meId, setMeId] = useState("");
  const [partnerPhoto, setPartnerPhoto] = useState("");
  const [challengePhoto, setChallengePhoto] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creating = useRef(false);

  const load = useCallback(async () => {
    const id = localStorage.getItem("moomate_me") || "";
    setMeId(id);
    if (!id) return;
    const res = await fetch(`/api/matches/${matchId}`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    setMatch(data.match); setPeople(data.participants || []); setGame(data.game);
    if (data.match.status === "rejected") {
      const roomId = localStorage.getItem("moomate_room");
      if (roomId) router.replace(`/room/${roomId}`);
    }
    if (data.match.status === "confirmed" && !data.game && !creating.current) {
      creating.current = true;
      try { await fetch(`/api/matches/${matchId}/game`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ participantId: id }) }); }
      finally { creating.current = false; }
    }
  }, [matchId, router]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 2500); return () => clearInterval(timer); }, [load]);

  const side: "a" | "b" = match?.participant_a === meId ? "a" : "b";
  const partner = people.find(p => p.id === (side === "a" ? match?.participant_b : match?.participant_a));
  const me = people.find(p => p.id === meId);
  const mineConfirmed = side === "a" ? match?.confirmed_a : match?.confirmed_b;
  const partnerConfirmed = side === "a" ? match?.confirmed_b : match?.confirmed_a;

  useEffect(() => {
    if (!match || !partner || !["confirmed", "completed"].includes(match.status)) return;
    if (!partner.photo_uploaded) { setPartnerPhoto(""); return; }
    fetch(`/api/photos/${partner.id}`, { headers: authHeaders() }).then(async r => { if (r.ok) setPartnerPhoto((await r.json()).url); });
  }, [match?.status, partner?.id, partner?.photo_uploaded]);
  useEffect(() => {
    if (!game?.answers?.challenges?.C2?.photoPath) return;
    fetch(`/api/game-photo/${game.id}/C2`, { headers: authHeaders() }).then(async r => { if (r.ok) setChallengePhoto((await r.json()).url); });
  }, [game?.id, game?.answers?.challenges?.C2?.photoPath]);

  async function decision(action: "confirm" | "reject") {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/matches/${matchId}/${action}`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ participantId: meId }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "操作失败");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "操作失败"); }
    finally { setBusy(false); }
  }

  async function submit(action: string, fields: Record<string, string> = {}, upload?: File) {
    if (!game) return;
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("action", action); body.set("participantId", meId);
      for (const [key, value] of Object.entries(fields)) body.set(key, value);
      if (upload) body.set("photo", upload);
      const res = await fetch(`/api/games/${game.id}/answer`, { method: "POST", headers: authHeaders(), body });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "操作失败");
      setGame(data.game); setText(""); setFile(null);
    } catch (e) { setError(e instanceof Error ? e.message : "操作失败"); await load(); }
    finally { setBusy(false); }
  }

  async function complete() {
    if (!game) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/games/${game.id}/complete`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ participantId: meId }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "生成失败");
      setGame(data.game); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "生成失败"); }
    finally { setBusy(false); }
  }

  if (!match) return <main className="min-h-screen p-8 text-center">正在读取匹配...</main>;
  const a = game?.answers;
  const taskDone = Boolean(a?.cardDone.task.a && a?.cardDone.task.b);
  const gameDone = Boolean(a?.cardDone.game.a && a?.cardDone.game.b);
  const slot = !taskDone ? "task" : !gameDone ? "game" : null;
  const card = slot ? game?.questions.cards[slot === "task" ? 0 : 1] : null;
  const myCardDone = slot ? a?.cardDone[slot][side] : false;
  const currentChallenge = gameDone ? game?.questions.challengeIds.find(key => {
    const result = a?.challenges[key];
    return key === "C2" ? !(result?.photoPath && result.confirmedA && result.confirmedB) : !(result?.a && result?.b);
  }) : undefined;
  const result = currentChallenge ? a?.challenges[currentChallenge] : undefined;
  const myChallengeDone = currentChallenge && currentChallenge !== "C2" ? Boolean(result?.[side]) : currentChallenge === "C2" ? Boolean(side === "a" ? result?.confirmedA : result?.confirmedB) : false;
  const allChallengesDone = gameDone && !currentChallenge;

  return <main className="min-h-screen max-w-xl mx-auto px-5 py-8">
    <h1 className="text-xl font-bold mb-4">🐮 今晚牛搭子</h1>
    {error && <p className="text-red-400 mb-3">{error}</p>}
    {match.status === "pending" && <section className="bg-[#1d1915] p-5 rounded-2xl space-y-4">
      <h2 className="text-lg font-bold">认识 {partner?.nickname || "新搭子"}？</h2>
      <p>{match.reason}</p>
      <p className="text-sm text-amber-300/70">双方同意后才能查看彼此已上传的照片。</p>
      {!mineConfirmed ? <>
        <button disabled={busy} onClick={() => void decision("confirm")} className="w-full bg-amber-500 text-black rounded-xl py-3 font-bold">愿意认识</button>
        <button disabled={busy} onClick={() => void decision("reject")} className="w-full bg-[#2a241f] rounded-xl py-3">暂不匹配</button>
      </> : <p className="text-amber-300">已同意，等待对方确认...</p>}
      {partnerConfirmed && <p className="text-xs text-amber-300/70">对方已同意，仍需你确认。</p>}
    </section>}
    {["confirmed", "completed"].includes(match.status) && <>
      <section className="bg-[#1d1915] p-5 rounded-2xl mb-5">
        <h2 className="font-bold mb-2">你与 {partner?.nickname}</h2>
        <p className="text-sm mb-3">{match.reason}</p>
        <p className="text-xs text-amber-300/70 mb-2">我的今晚标签：{me?.tags.join(" · ")}</p>
        {partner?.photo_uploaded ? partnerPhoto ? <img src={partnerPhoto} alt="对方已上传的照片" className="max-h-48 rounded-xl" /> : <p>正在读取对方照片...</p> : <p className="text-amber-300/80">对方未上传</p>}
      </section>
      {game?.status === "completed" && game.card ? <section className="bg-[#1d1915] p-5 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold text-amber-300">{game.card.title} · 今晚纪念卡</h2>
        <p className="text-xs">{new Date(game.card.completedAt).toLocaleString("zh-CN")}</p>
        {game.card.cards.map(c => <p key={c.id}>{c.id} {c.title} · {c.status}</p>)}
        {game.card.challenges.map(c => <div key={c.id}><p>{c.id} {CHALLENGES[c.id].title}</p>{c.id === "C2" ? challengePhoto && <img src={challengePhoto} alt="现场标志物合照" className="max-h-48 rounded-xl" /> : <p className="text-sm">A：{c.result?.a}<br />B：{c.result?.b}</p>}</div>)}
        <p>今晚总结 · {people.find(p => p.id === match.participant_a)?.nickname}：{game.card.summary.a}</p>
        <p>今晚总结 · {people.find(p => p.id === match.participant_b)?.nickname}：{game.card.summary.b}</p>
      </section> : game ? <>
        {card && slot && <section className="bg-[#1d1915] p-5 rounded-2xl mb-5 space-y-3">
          <p className="text-xs text-amber-300/70">{slot === "task" ? "线下任务卡 · 第 1 张" : "线下小游戏卡 · 第 2 张"}</p>
          <h2 className="font-bold">{card.id} {card.title}</h2><p>{card.text}</p>
          {card.detail?.map(line => <p key={line} className="text-sm text-amber-300/80">{line}</p>)}
          <p className="text-xs">线下自报完成，无需提交证明。剩余换卡 {20 - (a?.swapsUsed || 0)} 次。</p>
          <button disabled={busy || myCardDone || (a?.swapsUsed || 0) >= 20 || a?.cardDone[slot].a || a?.cardDone[slot].b} onClick={() => void submit("swap_card", { slot })} className="w-full bg-[#2a241f] py-2 rounded-xl disabled:opacity-40">换一个</button>
          <button disabled={busy || myCardDone} onClick={() => void submit("confirm_card", { slot })} className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl disabled:opacity-40">{myCardDone ? "已确认，等待对方" : "完成并继续"}</button>
        </section>}
        {currentChallenge && <section className="bg-[#1d1915] p-5 rounded-2xl mb-5 space-y-3">
          <p className="text-xs text-amber-300/70">挑战 {game.questions.challengeIds.indexOf(currentChallenge) + 1} / 2</p>
          <h2 className="font-bold">{currentChallenge} {CHALLENGES[currentChallenge].title}</h2>
          <p>{CHALLENGES[currentChallenge].text}</p>
          {currentChallenge === "C2" ? <>
            {!result?.photoPath && <><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} /><button disabled={busy || !file} onClick={() => file && void submit("challenge_answer", { challengeId: "C2" }, file)} className="w-full bg-amber-500 text-black py-3 rounded-xl disabled:opacity-40">上传双方同意的合照</button></>}
            {result?.photoPath && <>{challengePhoto && <img src={challengePhoto} alt="挑战合照" className="max-h-48 rounded-xl" />}<button disabled={busy || myChallengeDone} onClick={() => void submit("challenge_answer", { challengeId: "C2", confirm: "1" })} className="w-full bg-amber-500 text-black py-3 rounded-xl disabled:opacity-40">{myChallengeDone ? "已确认，等待对方" : "确认合照并完成"}</button></>}
          </> : myChallengeDone ? <p className="text-amber-300">已提交，等待对方...</p> : <><textarea value={text} onChange={e => setText(e.target.value)} className="w-full p-3 bg-[#2a241f] rounded-xl" placeholder="写下一句话" /><button disabled={busy || !text.trim()} onClick={() => void submit("challenge_answer", { challengeId: currentChallenge, text })} className="w-full bg-amber-500 text-black py-3 rounded-xl disabled:opacity-40">提交这一关</button></>}
        </section>}
        {allChallengesDone && <section className="bg-[#1d1915] p-5 rounded-2xl space-y-3">
          <h2 className="font-bold">输入一句话总结今晚</h2>
          {a?.summary[side] ? <p>你已填写：{a.summary[side]}</p> : <><textarea value={text} onChange={e => setText(e.target.value)} className="w-full p-3 bg-[#2a241f] rounded-xl" placeholder="今晚最想留下的一句话" /><button disabled={busy || !text.trim()} onClick={() => void submit("summary", { text })} className="w-full bg-amber-500 text-black py-3 rounded-xl disabled:opacity-40">保存我的总结</button></>}
          <button disabled={busy || !a?.summary.a || !a?.summary.b} onClick={() => void complete()} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl disabled:opacity-40">生成双人纪念卡</button>
        </section>}
      </> : <p>正在准备线下卡片...</p>}
    </>}
  </main>;
}
