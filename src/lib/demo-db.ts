import { randomUUID, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;
const directory = join(process.cwd(), ".demo-data");
const databaseFile = join(directory, "store.json");
const secretFile = join(directory, "token-secret");

function ensureDirectory() { if (!existsSync(directory)) mkdirSync(directory, { recursive: true }); }
export function demoDirectory() { ensureDirectory(); return directory; }
export function demoTokenSecret(): string {
  ensureDirectory();
  if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString("hex"), { flag: "wx" });
  return readFileSync(secretFile, "utf8").trim();
}

function read(): Tables {
  ensureDirectory();
  if (!existsSync(databaseFile)) return { rooms: [], participants: [], matches: [], games: [], room_messages: [] };
  return JSON.parse(readFileSync(databaseFile, "utf8"));
}
function save(db: Tables) { ensureDirectory(); writeFileSync(databaseFile, JSON.stringify(db, null, 2), "utf8"); }
function defaults(table: string, value: Row): Row {
  const common = { id: randomUUID(), created_at: new Date().toISOString() };
  const specific: Row = table === "rooms" ? { status: "active", theme: "今晚牛搭子", capacity: 20, expires_at: new Date(Date.now() + 12 * 3600_000).toISOString() }
    : table === "participants" ? { avatar: "🐮", gender: "secret", gender_preference: "any", tags: [], photo_path: null, photo_uploaded: false, status: "waiting", match_id: null, answers: null, ai_profile: null, is_virtual: false }
    : table === "matches" ? { status: "pending", score: 0, reason: "", confirmed_a: false, confirmed_b: false }
    : table === "games" ? { status: "active", type: "线下双人卡片", questions: [], answers: {}, review: null, card: null, round_feedback: {} }
    : {};
  return { ...common, ...specific, ...value };
}
function equal(a: unknown, b: unknown): boolean {
  if (typeof a === "object" || typeof b === "object") {
    try { return JSON.stringify(a) === (typeof b === "string" ? b : JSON.stringify(b)); } catch { return false; }
  }
  return a === b;
}

class DemoQuery implements PromiseLike<{ data: any; error: any; count?: number }> {
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private columns = "*";
  private payload: Row | Row[] | null = null;
  private filters: Array<(row: Row) => boolean> = [];
  private head = false;
  private orderBy: string | null = null;
  private ascending = true;
  private max: number | null = null;
  constructor(private table: string) {}
  select(columns = "*", options?: { count?: string; head?: boolean }) { this.columns = columns; this.head = Boolean(options?.head); return this; }
  insert(value: Row | Row[]) { this.operation = "insert"; this.payload = value; return this; }
  update(value: Row) { this.operation = "update"; this.payload = value; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(key: string, value: unknown) { this.filters.push(row => equal(row[key], value)); return this; }
  neq(key: string, value: unknown) { this.filters.push(row => !equal(row[key], value)); return this; }
  in(key: string, values: unknown[]) { this.filters.push(row => values.some(v => equal(row[key], v))); return this; }
  order(key: string, options?: { ascending?: boolean }) { this.orderBy = key; this.ascending = options?.ascending !== false; return this; }
  limit(value: number) { this.max = value; return this; }
  private project(row: Row): Row {
    if (this.columns === "*") return structuredClone(row);
    const result: Row = {};
    for (const col of this.columns.split(",").map(v => v.trim())) if (col in row) result[col] = structuredClone(row[col]);
    return result;
  }
  private run(one: boolean) {
    const db = read();
    const rows = db[this.table] || (db[this.table] = []);
    const matches = (row: Row) => this.filters.every(f => f(row));
    let result: Row[] = [];
    if (this.operation === "select") result = rows.filter(matches);
    if (this.operation === "insert") {
      const inserted = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(v => defaults(this.table, v || {}));
      if (this.table === "games" && inserted.some(v => rows.some(r => r.match_id === v.match_id))) return { data: null, error: { message: "该匹配已有游戏" } };
      if (this.table === "rooms" && inserted.some(v => rows.some(r => r.code === v.code))) return { data: null, error: { message: "房间码已存在" } };
      rows.push(...inserted); result = inserted; save(db);
    }
    if (this.operation === "update") {
      result = rows.filter(matches);
      for (const row of result) Object.assign(row, structuredClone(this.payload));
      if (result.length) save(db);
    }
    if (this.operation === "delete") {
      result = rows.filter(matches);
      db[this.table] = rows.filter(row => !matches(row));
      if (result.length) save(db);
    }
    const count = result.length;
    if (this.orderBy) result.sort((a, b) => String(a[this.orderBy!]).localeCompare(String(b[this.orderBy!])) * (this.ascending ? 1 : -1));
    if (this.max !== null) result = result.slice(0, this.max);
    if (this.head) return { data: null, error: null, count };
    const data = result.map(row => this.project(row));
    if (one) return { data: data[0] || null, error: null, count };
    return { data, error: null, count };
  }
  maybeSingle() { return Promise.resolve(this.run(true)); }
  single() { const value = this.run(true); return Promise.resolve(value.data ? value : { ...value, error: { message: "没有找到记录" } }); }
  then<TResult1 = { data: any; error: any; count?: number }, TResult2 = never>(onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run(false)).then(onfulfilled, onrejected);
  }
}

export const demoClient = { from(table: string) { return new DemoQuery(table); } };
