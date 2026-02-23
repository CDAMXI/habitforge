import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("habits.db");

// Initialize database
db.exec(`
  DROP TABLE IF EXISTS completions;
  DROP TABLE IF EXISTS habits;

  CREATE TABLE habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    frequency TEXT DEFAULT 'daily',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER,
    completed_at DATE NOT NULL,
    proof_image_url TEXT,
    FOREIGN KEY(habit_id) REFERENCES habits(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/habits", (req, res) => {
    const habits = db.prepare("SELECT * FROM habits").all();
    const completions = db.prepare("SELECT * FROM completions WHERE completed_at = date('now')").all();
    res.json({ habits, completions });
  });

  app.post("/api/habits", (req, res) => {
    const { name, emoji, color } = req.body;
    const info = db.prepare("INSERT INTO habits (name, emoji, color) VALUES (?, ?, ?)").run(name, emoji, color);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/habits/:id", (req, res) => {
    db.prepare("DELETE FROM habits WHERE id = ?").run(req.params.id);
    db.prepare("DELETE FROM completions WHERE habit_id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/complete", (req, res) => {
    const { habit_id, date, proof_image_url } = req.body;
    const existing = db.prepare("SELECT id FROM completions WHERE habit_id = ? AND completed_at = ?").get(habit_id, date);
    
    if (existing) {
      if (proof_image_url) {
        // Update existing with image
        db.prepare("UPDATE completions SET proof_image_url = ? WHERE id = ?").run(proof_image_url, existing.id);
        res.json({ status: "updated" });
      } else {
        // Toggle off
        db.prepare("DELETE FROM completions WHERE id = ?").run(existing.id);
        res.json({ status: "uncompleted" });
      }
    } else {
      // Create new
      db.prepare("INSERT INTO completions (habit_id, completed_at, proof_image_url) VALUES (?, ?, ?)")
        .run(habit_id, date, proof_image_url || null);
      res.json({ status: "completed" });
    }
  });

  app.get("/api/stats", (req, res) => {
    const stats = db.prepare(`
      SELECT h.name, COUNT(c.id) as completion_count 
      FROM habits h 
      LEFT JOIN completions c ON h.id = c.habit_id 
      GROUP BY h.id
    `).all();
    res.json(stats);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
