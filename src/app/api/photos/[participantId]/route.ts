import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { participantFromRequest } from "@/lib/participant-auth";
import { createSignedUrl } from "@/lib/photo";

export async function GET(req: Request, ctx: { params: Promise<{ participantId: string }> }) {
  try {
    const { participantId: id } = await ctx.params;
    const viewer = await participantFromRequest(req);
    if (!viewer) return NextResponse.json({ error: "请重新扫码进入" }, { status: 401 });

    const sb = getSupabase();
    const { data: target } = await sb.from("participants").select("match_id,photo_path").eq("id", id).maybeSingle();
    if (!target) return NextResponse.json({ error: "照片不存在" }, { status: 404 });
    if (!viewer.match_id || viewer.match_id !== target.match_id) {
      return NextResponse.json({ error: "无权查看该照片" }, { status: 403 });
    }
    const { data: match } = await sb.from("matches").select("status").eq("id", viewer.match_id).maybeSingle();
    if (!match || !["confirmed", "completed"].includes(match.status)) {
      return NextResponse.json({ error: "尚未双方确认，无法解锁照片" }, { status: 403 });
    }
    if (!target.photo_path) return NextResponse.json({ hasPhoto: false, error: "对方未上传" }, { status: 404 });

    return NextResponse.json({ hasPhoto: true, url: await createSignedUrl(target.photo_path) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "获取失败" }, { status: 500 });
  }
}

