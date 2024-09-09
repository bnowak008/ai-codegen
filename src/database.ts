import { Database } from 'sqlite3'

// Open a SQLite database, stored in the file db.sqlite
const db = new Database('../codegen.db');

export async function initializeDatabase() {
    console.log('Initializing database...');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS codegen_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT,
      step TEXT,
      response TEXT,
      created_at TEXT
    )
  `);
}

export async function saveStep(prompt: string, step: string, response: string) {
  await db.run(
    `INSERT INTO codegen_history (prompt, step, response, created_at) VALUES (?, ?, ?, datetime('now'))`,
    [prompt, step, response]
  );
}
