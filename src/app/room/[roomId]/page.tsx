"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QUIZ, validAnswers, type QuizAnswers } from "@/lib/quiz";
import { authHeaders } from "@/lib/client-auth";

type Me = { id: string; room_id: string; nickname: string; tags: string[]; answers: QuizAnswers | null; ai_profile: { source?: string } | null; photo_uploaded: boolean; match_id: string | null };
type Match = { id: string; participant_a: string; participant_b: string; status: string; reason: string };

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<{ code: string; theme: string } | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const stateRes = await fetch(`/api/rooms/state/${roomId}`);
    if (!stateRes.ok) return;
    const state = await stateRes.json();
    setRoom(state.room);
    setMatches(state.matches || []);
    const id = localStorage.getItem(`participant_${state.room.code}`);
    if (!id) return;
    const meRes = await fetch(`/api/participants/${id}`, { headers: authHeaders() });
    if (meRes.ok) { const data = await meRes.json(); setMe(data.participant); }
  }, [roomId]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 3000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { localStorage.setItem("moomate_room", roomId); }, [roomId]);

  const match = matches.find(m => m.id === me?.match_id);
  useEffect(() => { if (match && ["confirmed", "completed"].includes(match.status)) router.replace(`/match/${match.id}`); }, [match, router]);
  const done = validAnswers(me?.answers);

  async function save() {
    if (!me || !validAnswers(answers)) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/participants/${me.id}/profile`, { method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ answers }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setMe(data.participant);
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); }
    finally { setBusy(false); }
  }

  async function upload(file: File) {
    if (!me) return;
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.set("photo", file);
      const res = await fetch(`/api/participants/${me.id}/photo`, { method: "POST", headers: authHeaders(), body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "上传失败"); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen max-w-xl mx-auto px-5 py-8">
    <h1 className="text-xl font-bold mb-2">🐮 {room?.theme || "今晚牛搭子"}</h1>
    <p className="text-amber-300/80 mb-5">{me ? `${me.nickname} · ${done ? "资料已完成" : "请完成 10 题"}` : "正在识别身份..."}</p>
    {!me && room && <a href={`/join/${room.code}`} className="text-amber-400 underline">重新扫码或返回加入页</a>}
    {me && <>
      {!done && <section className="space-y-5 mb-6">
        {QUIZ.map((q, i) => <div key={q.key} className="bg-[#1d1915] rounded-2xl p-4 border border-amber-900/40">
          <h2 className="font-bold mb-1">{i + 1}. {q.question}</h2>
          <p className="text-xs text-amber-300/70 mb-3">单选 · 必答</p>
          <div className="grid grid-cols-2 gap-2">{q.options.map(option => <button key={option} onClick={() => setAnswers(v => ({ ...v, [q.key]: option }))} className={`p-2 rounded-xl text-sm ${answers[q.key] === option ? "bg-amber-500 text-black" : "bg-[#2a241f]"}`}>{option}</button>)}</div>
        </div>)}
        <button disabled={busy || !validAnswers(answers)} onClick={save} className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl disabled:opacity-40">{busy ? "保存中..." : "提交问卷并生成标签"}</button>
      </section>}
      {done && <section className="bg-[#1d1915] rounded-2xl p-5 mb-5 border border-amber-900/40">
        <h2 className="font-bold mb-2">今晚标签 <span className="text-xs text-amber-300/70">（{me.ai_profile?.source === "ai" ? "AI 标签" : "规则标签"}）</span></h2>
        <div className="flex flex-wrap gap-2">{(me.tags || []).map(tag => <span key={tag} className="px-2 py-1 bg-amber-800/30 rounded-full text-sm">{tag}</span>)}</div>
      </section>}
      <section className="bg-[#1d1915] rounded-2xl p-5 mb-5 border border-amber-900/40">
        <h2 className="font-bold mb-1">可选照片</h2>
        <p className="text-sm text-amber-300/70 mb-3">人、环境或物品均可。上传后仅显示「已上传」；不上传也可匹配。</p>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
        {me.photo_uploaded && <p className="text-emerald-400 text-sm mt-2">已上传</p>}
      </section>
      {match?.status === "pending" ? <section className="bg-amber-900/30 rounded-2xl p-5">
        <h2 className="font-bold mb-2">找到一位搭子</h2><p className="text-sm mb-3">{match.reason}</p>
        <button onClick={() => router.push(`/match/${match.id}`)} className="bg-amber-500 text-black font-bold px-4 py-2 rounded-xl">查看并互选</button>
      </section> : done && !match ? <p className="text-center text-amber-300/80">资料已完成，等待主理人发起匹配。暂无新候选时请继续等待。</p> : null}
    </>}
    {error && <p className="text-red-400 mt-4">{error}</p>}
  </main>;
}
