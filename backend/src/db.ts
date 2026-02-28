import mysql from 'mysql2/promise';

export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

let pool: mysql.Pool | null = null;

export function dbEnabled(): boolean {
  // Only enable if minimum connection info exists
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE);
}

export function getDbPool(): mysql.Pool {
  if (!dbEnabled()) {
    throw new Error('MySQL is not configured. Set MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE (and optional MYSQL_PASSWORD, MYSQL_PORT).');
  }
  if (pool) return pool;

  const cfg: DbConfig = {
    host: process.env.MYSQL_HOST!,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE!,
  };

  pool = mysql.createPool({
    ...cfg,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE ?? 10),
    // Keep it simple for an IoT project. You can add ssl here if your DB provider requires it.
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  return pool;
}

export async function dbPing(): Promise<boolean> {
  if (!dbEnabled()) return false;
  try {
    const p = getDbPool();
    await p.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function dbPingDetailed(): Promise<{ ok: boolean; error?: string }> {
  if (!dbEnabled()) return { ok: false, error: 'MYSQL_* env not configured' };
  try {
    const p = getDbPool();
    await p.query('SELECT 1');
    return { ok: true };
  } catch (e: any) {
    // Keep it short; do not include secrets.
    const msg = typeof e?.message === 'string' ? e.message : String(e);
    return { ok: false, error: msg };
  }
}