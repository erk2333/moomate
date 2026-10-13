export const QUIZ = [
  { key: "social_role", question: "在派对里，你通常先做什么？", options: ["组织大家", "带动气氛", "自在参与", "先看看"] },
  { key: "game_style", question: "玩小游戏时，你更喜欢？", options: ["合作完成", "轻松体验", "来点竞争"] },
  { key: "interaction", question: "刚认识时，哪种互动最舒服？", options: ["主动聊聊", "边玩边熟", "不要突然点我名", "可以互相开玩笑"] },
  { key: "partner_expectation", question: "你想遇见哪种玩伴？", options: ["会聊天", "愿意一起行动", "轻松随和", "有共同爱好"] },
  { key: "tonight_goal", question: "今晚最想做什么？", options: ["认识新朋友", "放松一下", "多玩游戏", "去舞池"] },
  { key: "crowd_preference", question: "更喜欢哪种聚会范围？", options: ["两三人小圈", "热闹大场"] },
  { key: "icebreak_style", question: "陌生人很多时，你会？", options: ["主动打招呼", "熟了再说", "看现场氛围"] },
  { key: "interest", question: "最想聊或玩的兴趣是？", options: ["音乐", "运动", "旅行", "游戏", "美食"] },
  { key: "novelty", question: "有人邀请新玩法时，你会？", options: ["愿意尝鲜", "先弄明白再参加"] },
  { key: "after_party", question: "派对结束后更想？", options: ["吃宵夜", "散步聊聊", "再玩一局", "适时回家"] },
] as const;

export type QuizKey = (typeof QUIZ)[number]["key"];
export type QuizAnswers = Record<QuizKey, string>;

export function validAnswers(value: unknown): value is QuizAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answers = value as Record<string, unknown>;
  return Object.keys(answers).length === QUIZ.length && QUIZ.every(q => typeof answers[q.key] === "string" && (q.options as readonly string[]).includes(answers[q.key] as string));
}

const MAP: Record<QuizKey, Record<string, string>> = {
  social_role: { "组织大家": "组织者", "带动气氛": "气氛担当", "自在参与": "自在参与", "先看看": "先观察" },
  game_style: { "合作完成": "合作派", "轻松体验": "轻松体验派", "来点竞争": "竞技派" },
  interaction: { "主动聊聊": "喜欢主动交流", "边玩边熟": "喜欢边玩边熟", "不要突然点我名": "不爱被点名", "可以互相开玩笑": "玩笑友好型" },
  partner_expectation: { "会聊天": "想找会聊天的搭子", "愿意一起行动": "想找行动派搭子", "轻松随和": "想找轻松随和的搭子", "有共同爱好": "想找同好" },
  tonight_goal: { "认识新朋友": "交友优先", "放松一下": "放松为主", "多玩游戏": "游戏优先", "去舞池": "舞池活跃" },
  crowd_preference: { "两三人小圈": "小圈聊天", "热闹大场": "热闹大场" },
  icebreak_style: { "主动打招呼": "主动破冰", "熟了再说": "慢热型", "看现场氛围": "看氛围" },
  interest: { "音乐": "音乐控", "运动": "运动爱好者", "旅行": "旅行爱好者", "游戏": "游戏爱好者", "美食": "美食爱好者" },
  novelty: { "愿意尝鲜": "爱尝鲜", "先弄明白再参加": "先了解再参加" },
  after_party: { "吃宵夜": "宵夜续摊派", "散步聊聊": "散步聊天派", "再玩一局": "再玩一局派", "适时回家": "适时回家派" },
};

export function candidates(answers: QuizAnswers): string[] {
  return QUIZ.map(q => MAP[q.key][answers[q.key]]);
}

export function ruleTags(a: QuizAnswers): string[] {
  const social = ["组织大家", "带动气氛"].includes(a.social_role)
    ? MAP.social_role[a.social_role] : MAP.icebreak_style[a.icebreak_style];
  const interaction = ["边玩边熟", "不要突然点我名"].includes(a.interaction)
    ? MAP.interaction[a.interaction] : MAP.game_style[a.game_style];
  const tags = [social, interaction, MAP.tonight_goal[a.tonight_goal], MAP.interest[a.interest], MAP.after_party[a.after_party]];
  return [...new Set(tags)].slice(0, 5);
}
