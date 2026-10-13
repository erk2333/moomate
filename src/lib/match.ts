import type { Gender, GenderPreference } from "@/types";
import type { QuizAnswers } from "@/lib/quiz";
import { networkInterfaces } from "node:os";

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function localNetworkAddress(): string | null {
  const addresses = Object.values(networkInterfaces()).flatMap((items) => items || [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
  return addresses.find((address) => /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(address)) || addresses[0] || null;
}

export function siteOrigin(request?: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.URL) return process.env.URL.replace(/\/$/, "");
  if (process.env.DEPLOY_PRIME_URL) return process.env.DEPLOY_PRIME_URL.replace(/\/$/, "");
  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const host = forwardedHost || request.headers.get("host");
    if (host) {
      const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
      const protocol = forwardedProtocol || new URL(request.url).protocol.replace(/:$/, "");
      const incoming = new URL(`${protocol}://${host}`);
      if (["localhost", "127.0.0.1", "::1"].includes(incoming.hostname)) {
        const address = localNetworkAddress();
        if (address) return `${protocol}://${address}${incoming.port ? `:${incoming.port}` : ""}`;
      }
      return incoming.origin;
    }
  }
  return "http://localhost:3000";
}

const GOAL_COMPLEMENT = new Set(["认识新朋友|多玩游戏", "多玩游戏|认识新朋友"]);
const ACTIVE = new Set(["组织大家", "带动气氛", "主动打招呼"]);
const SLOW = new Set(["先看看", "熟了再说"]);

export function scorePairDetails(a: QuizAnswers, b: QuizAnswers): { score: number; reason: string; hits: Array<{ points: number; text: string }> } {
  const hits: Array<{ points: number; text: string }> = [];
  const add = (points: number, text: string) => { if (points) hits.push({ points, text }); };
  if (a.tonight_goal === b.tonight_goal) add(4, `你们今晚都想${a.tonight_goal}`);
  else if (GOAL_COMPLEMENT.has(`${a.tonight_goal}|${b.tonight_goal}`)) add(2, "一位想认识新朋友，一位想多玩游戏，可以一起从游戏开始破冰");

  const aActive = ACTIVE.has(a.social_role) || ACTIVE.has(a.icebreak_style);
  const bActive = ACTIVE.has(b.social_role) || ACTIVE.has(b.icebreak_style);
  const aSlow = SLOW.has(a.social_role) || SLOW.has(a.icebreak_style);
  const bSlow = SLOW.has(b.social_role) || SLOW.has(b.icebreak_style);
  if ((aActive && bSlow) || (bActive && aSlow)) add(3, "一位愿意主动破冰，另一位更喜欢慢慢熟悉");
  else if (a.social_role === b.social_role || a.icebreak_style === b.icebreak_style) add(2, "你们的社交节奏相近");

  if (a.interaction === b.interaction) add(2, `你们都喜欢${a.interaction}的互动方式`);
  if (a.game_style === b.game_style || new Set([a.game_style, b.game_style]).size === 2 && [a.game_style, b.game_style].every(v => ["合作完成", "轻松体验"].includes(v))) add(2, "你们的游戏方式相近或适合一起轻松合作");
  if (a.interest === b.interest) add(3, `你们都对${a.interest}感兴趣`);

  const meets = (want: string, other: QuizAnswers, self: QuizAnswers) => {
    switch (want) {
      case "会聊天": return ["主动打招呼", "主动聊聊", "带动气氛"].includes(other.icebreak_style) || ["主动聊聊", "可以互相开玩笑"].includes(other.interaction);
      case "愿意一起行动": return ["组织大家", "带动气氛"].includes(other.social_role) || other.icebreak_style === "主动打招呼";
      case "轻松随和": return other.game_style === "轻松体验" || other.tonight_goal === "放松一下";
      case "有共同爱好": return other.interest === self.interest;
      default: return false;
    }
  };
  if (meets(a.partner_expectation, b, a) || meets(b.partner_expectation, a, b)) add(3, "你们的玩伴期待能从对方的回答中找到对应点");
  if (a.crowd_preference === b.crowd_preference) add(1, "你们偏好的聚会范围相同");
  if (a.novelty === b.novelty) add(1, "你们对新玩法的态度相同");
  if (a.after_party === b.after_party) add(1, "你们派对后的安排偏好相同");
  hits.sort((x, y) => y.points - x.points || x.text.localeCompare(y.text, "zh-CN"));
  return { score: hits.reduce((n, h) => n + h.points, 0), hits, reason: hits.slice(0, 2).map(h => h.text).join("；") || "你们的偏好没有明显冲突，可以从一张轻松的任务卡开始认识" };
}

export function scorePair(a: QuizAnswers, b: QuizAnswers): number { return scorePairDetails(a, b).score; }

export function genderCompatible(a: Gender, b: Gender, prefA: GenderPreference, prefB: GenderPreference): boolean {
  if (a === "secret" || b === "secret") return true;
  const check = (gender: Gender, pref: GenderPreference) => pref === "any" || pref === gender;
  return check(b, prefA) && check(a, prefB);
}

export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}
