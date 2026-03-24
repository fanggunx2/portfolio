const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'portfolio.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Create works table
  db.run(`
    CREATE TABLE IF NOT EXISTS works (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create admin table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `, (err) => {
    if (!err) {
      // Insert default admin if not exists
      // Default username: admin, password: portfolio123
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('portfolio123', 10);
      db.run(`INSERT OR IGNORE INTO admin (id, username, password) VALUES (1, 'admin', ?)`, [hash]);
    }
  });
});

module.exports = db;
