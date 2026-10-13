import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isExpired } from "@/lib/match";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const sb = getSupabase();
    const { data: room } = await sb.from("rooms").select("id,code,theme,status,expires_at,capacity").eq("code", code).maybeSingle();
    if (!room || isExpired(room.expires_at) || room.status === "ended") {
      return NextResponse.json({ error: "房间不存在或已结束" }, { status: 404 });
    }
    return NextResponse.json({ room: { id: room.id, code: room.code, theme: room.theme, capacity: room.capacity } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "查询失败" }, { status: 500 });
  }
}
