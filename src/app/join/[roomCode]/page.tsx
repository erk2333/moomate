"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authHeaders, participantToken } from "@/lib/client-auth";

export default function JoinPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<{ id: string; theme: string } | null>(null);
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState("secret");
  const [preference, setPreference] = useState("any");
  const [mode, setMode] = useState<"dual" | "multi" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "房间不可用");
      setRoom(data.room);
    }).catch(e => setError(e.message));
    const saved = localStorage.getItem(`participant_${roomCode}`);
    if (saved && participantToken()) {
      fetch(`/api/participants/${saved}`, { headers: authHeaders() }).then(async r => {
        if (r.ok) { const data = await r.json(); localStorage.setItem("moomate_me", saved); router.replace(`/room/${data.participant.room_id}`); }
      });
    }
  }, [roomCode, router]);

  async function join() {
    if (!nickname.trim() || !room || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/rooms/${roomCode}/join`, {
        method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ nickname, gender, gender_preference: preference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加入失败");
      localStorage.setItem(`participant_${roomCode}`, data.participant.id);
      localStorage.setItem("moomate_me", data.participant.id);
      localStorage.setItem("moomate_token", data.participantToken);
      router.replace(`/room/${data.participant.room_id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "加入失败"); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen max-w-md mx-auto px-5 py-12">
    <h1 className="text-2xl font-bold text-center mb-2">🐮 今晚牛搭子</h1>
    <p className="text-center text-amber-300/80 mb-8">{room?.theme || "正在读取房间..."}</p>
    <div className="space-y-4 bg-[#1d1915] border border-amber-900/40 rounded-3xl p-6">
      <button onClick={() => setMode("dual")} className={`w-full rounded-xl py-3 font-bold ${mode === "dual" ? "bg-amber-500 text-black" : "bg-[#2a241f]"}`}>双人匹配</button>
      <button onClick={() => setMode("multi")} className="w-full rounded-xl py-3 bg-[#2a241f]">多人匹配</button>
      {mode === "multi" && <p className="text-center text-amber-300">暂未开放</p>}
      {mode === "dual" && <>
        <label className="block text-sm">昵称<input value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} className="block w-full mt-1 p-3 rounded-xl bg-[#2a241f]" placeholder="今晚怎么称呼你" /></label>
        <label className="block text-sm">我的性别
          <select value={gender} onChange={e => setGender(e.target.value)} className="block w-full mt-1 p-3 rounded-xl bg-[#2a241f]"><option value="secret">不愿透露</option><option value="male">男</option><option value="female">女</option></select>
        </label>
        <label className="block text-sm">希望匹配
          <select value={preference} onChange={e => setPreference(e.target.value)} className="block w-full mt-1 p-3 rounded-xl bg-[#2a241f]"><option value="any">不限</option><option value="male">男生</option><option value="female">女生</option></select>
        </label>
        <button onClick={join} disabled={busy || !nickname.trim() || !room} className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl disabled:opacity-40">{busy ? "进入中..." : "进入房间"}</button>
      </>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  </main>;
}
