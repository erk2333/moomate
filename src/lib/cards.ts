export interface OfflineCard { id: string; title: string; text: string; detail?: string[]; tags?: string[] }

export const TASK_CARDS: OfflineCard[] = [
  { id: "T1", title: "共同点", text: "各说一个近期喜欢的事，找出一个共同点。", tags: ["交友优先"] },
  { id: "T2", title: "给物品起名", text: "在现场选一件都觉得有趣的物品，给它起名字。", tags: ["爱尝鲜"] },
  { id: "T3", title: "一小时路线", text: "各推荐一个下次想去的地方，拼成一条一小时路线。", tags: ["旅行爱好者"] },
  { id: "T4", title: "今晚标题", text: "各分享一个最近的小确幸，共同给今晚起个标题。", tags: ["放松为主"] },
  { id: "T5", title: "兴趣提问", text: "用对方选的兴趣提一个轻松问题，轮流回答。", tags: ["音乐控", "运动爱好者", "游戏爱好者", "美食爱好者"] },
  { id: "T6", title: "氛围角落", text: "一起找现场最有氛围的角落，说说各自的理由。", tags: ["热闹大场"] },
];

export const GAME_CARDS: OfflineCard[] = [
  { id: "G1", title: "三道二选一", text: "同时说出「海边或山里」「早起或夜猫」等 3 道二选一答案，看看有几题相同。" },
  { id: "G2", title: "今晚三个词", text: "各用 3 个词描述今晚，再找一个相近的词。" },
  { id: "G3", title: "周末猜猜看", text: "轮流猜对方会选哪种周末活动，猜完再揭晓。" },
  { id: "G4", title: "物品描述", text: "一人描述现场一件物品但不说名称，另一人猜。" },
  { id: "G5", title: "指向角落", text: "同时指向现场最想停留的角落，交换理由。" },
  { id: "G6", title: "20 秒推荐", text: "各用 20 秒向对方推荐一件自己喜欢的小事，再互换角色。" },
  { id: "G7", title: "牛牛翻译官", text: "翻译者先转身，表达者独自看秘密台词后扣下手机；只用「哞」、表情和动作演 20 秒。翻译者口头猜一句，可问 1 个是/否问题；表达者点头或摇头，然后口头揭晓。交换角色再玩一轮。猜错也算完成。", detail: ["派对日常：我已经准备回家了，但这首歌把我叫回来了", "吃货现场：我第三次路过零食桌，只是在确认它还在", "派对日常：我不是高冷，我只是在想第一句话", "音乐上头：这是最后一局——上一局我也是这么说的", "猜中可口头授予「牛语知音」；猜得离谱又有趣可口头授予「神级脑补」。"], tags: ["游戏优先", "玩笑友好型"] },
  { id: "G8", title: "奇葩辩论庭", text: "派对最后一块蛋糕，应该归最饿的人，还是最会夸它的人？自行选边，各用约 20 秒说一句理由；读出两条突发证据，各用一句话圆回自己的立场，最后共同起一个判词。默认不分输赢，不要求拿取或分食蛋糕。", detail: ["证据一：这块蛋糕特别爱听好话", "证据二：蛋糕还有一分钟就要被收走"], tags: ["美食爱好者", "玩笑友好型"] },
];

export const CHALLENGES = {
  C1: { id: "C1", title: "最搞笑的瞬间", text: "今晚你觉得对方最搞笑的一个瞬间是什么？双方各填一句。", type: "text" },
  C2: { id: "C2", title: "现场标志物合照", text: "找现场一个标志性物品拍合照。双方同意后上传 1 张合照；可不露脸，标志物须入镜。", type: "photo" },
  C3: { id: "C3", title: "一句话形容玩伴", text: "一句话形容你的玩伴。双方各填一句。", type: "text" },
} as const;

export type ChallengeId = keyof typeof CHALLENGES;

export function chooseCard(slot: "task" | "game", tags: string[], exclude?: string): OfflineCard {
  const pool = (slot === "task" ? TASK_CARDS : GAME_CARDS).filter(c => c.id !== exclude);
  const ranked = pool.map(c => ({ card: c, weight: 1 + (c.tags || []).filter(t => tags.includes(t)).length * 2 }));
  const total = ranked.reduce((n, x) => n + x.weight, 0);
  let roll = Math.random() * total;
  for (const item of ranked) { roll -= item.weight; if (roll < 0) return item.card; }
  return ranked[ranked.length - 1].card;
}

export function chooseChallenges(): ChallengeId[] {
  const ids: ChallengeId[] = ["C1", "C2", "C3"];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, 2);
}
