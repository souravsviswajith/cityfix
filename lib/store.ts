import { promises as fs } from 'fs';
import path from 'path';
import type { DBShape } from './types';
import { buildSeedReports } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function freshDB(): DBShape {
  return { users: [], sessions: [], otps: [], reports: buildSeedReports(), counters: { reportSeq: 200 } };
}

async function readDB(): Promise<DBShape> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DBShape;
    if (!parsed.reports) parsed.reports = [];
    if (!parsed.counters) parsed.counters = { reportSeq: 100 + parsed.reports.length };
    return parsed;
  } catch {
    const db = freshDB();
    await writeDB(db);
    return db;
  }
}

async function writeDB(db: DBShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_PATH);
}

// Serialise mutations to avoid interleaved writes
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (db: DBShape) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDB();
    const result = await fn(db);
    await writeDB(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const db = {
  async get(): Promise<DBShape> {
    return readDB();
  },
  mutate,
  nextRefNo(dbShape: DBShape): string {
    dbShape.counters.reportSeq += 1;
    const year = new Date().getFullYear();
    return `CFX-${year}-${String(dbShape.counters.reportSeq).padStart(4, '0')}`;
  },
};
