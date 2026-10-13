"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Participant = { id: string; nickname: string; status: string; photo_uploaded: boolean; tags: string[] };
type Match = { id: string; participant_a: string; participant_b: string; status: string; score: number; reason: string };

export default function HostPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<{ code: string; theme: string } | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [qr, setQr] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const token = localStorage.getItem(`host_${roomId}`);
    if (!token) { setError("本机没有主理人凭证，请从建房设备打开。"); return; }
    const res = await fetch(`/api/host/${roomId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "加载失败"); return; }
    setRoom(data.room); setParticipants(data.participants || []); setMatches(data.matches || []); setQr(data.qrDataUrl || ""); setJoinUrl(data.joinUrl || "");
  }, [roomId]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 4000); return () => clearInterval(timer); }, [load]);

  async function startMatch() {
    if (!room) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/match`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostToken: localStorage.getItem(`host_${roomId}`) }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "匹配失败");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "匹配失败"); }
    finally { setBusy(false); }
  }

  const name = (id: string) => participants.find(p => p.id === id)?.nickname || "参与者";
  return <main className="min-h-screen max-w-lg mx-auto px-5 py-8">
    <h1 className="text-xl font-bold mb-2">主理人 · {room?.theme || "今晚牛搭子"}</h1>
    {room && <p className="text-sm text-amber-300/70 mb-4">房间码 {room.code}</p>}
    {qr && <section className="bg-[#1d1915] p-5 rounded-2xl text-center mb-5"><img src={qr} alt="入房二维码" className="mx-auto w-48 h-48 bg-white p-2 rounded-xl" /><p className="text-xs break-all mt-2">{joinUrl}</p></section>}
    {room && <button disabled={busy} onClick={startMatch} className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl disabled:opacity-40 mb-5">{busy ? "计算中..." : "开始双人匹配"}</button>}
    {error && <p className="text-red-400 mb-4">{error}</p>}
    <section className="bg-[#1d1915] p-5 rounded-2xl mb-5"><h2 className="font-bold mb-2">参与者 {participants.length}</h2>{participants.map(p => <p key={p.id} className="text-sm py-1">{p.nickname} · {p.status} · {p.tags?.length === 5 ? "问卷完成" : "待完成问卷"} · {p.photo_uploaded ? "已上传" : "未上传照片"}</p>)}</section>
    <section className="bg-[#1d1915] p-5 rounded-2xl"><h2 className="font-bold mb-2">匹配 {matches.length}</h2>{matches.map(m => <p key={m.id} className="text-sm py-2 border-t border-amber-900/30">{name(m.participant_a)} × {name(m.participant_b)} · {m.status} · {m.score} 分<br />{m.reason}</p>)}</section>
  </main>;
}
