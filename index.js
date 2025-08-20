const express = require('express')
const sqlite3 = require('sqlite3').verbose();
const app = express()
const ws = require('ws')
const bodyParser = require('body-parser')
const cors = require('cors')
require('dotenv').config()
const port = process.env.port || 3000
const version = process.env.version || '1.0.0'

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// Database initialization
const db = new sqlite3.Database('./data/database.db', (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to the database');
    db.run(`
      CREATE TABLE IF NOT EXISTS user (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        registration_time INTEGER NOT NULL,
        token TEXT NOT NULL,
        is_banned INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0,
        avatar_id TEXT,
        last_online INTEGER
      )
    `, (err) => {
      if (err) {
        console.error('Could not ensure user table exists:', err);
      }
    });
  }
});

// Chat database initialization
const chatDb = new sqlite3.Database('./data/chat.db', (err) => {
  if (err) {
    console.error('Could not connect to chat database', err);
  } else {
    console.log('Connected to the chat database');
    chatDb.run(`
      CREATE TABLE IF NOT EXISTS chat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT,
        member_ids TEXT NOT NULL, -- JSON array of numbers
        description TEXT,
        admin_ids TEXT NOT NULL,  -- JSON array of numbers
        banned_user_ids TEXT NOT NULL, -- JSON array of numbers
        is_dm INTEGER NOT NULL    -- 0 or 1
      )
    `, (err) => {
      if (err) {
        console.error('Could not ensure chat table exists:', err);
      }
    });
  }
});

// Basic routes
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/ELUA', (req, res) => {
  res.sendFile(__dirname + '/ELUA.md')
})

app.get('/api/version', (req, res) => {
  res.send(version)
})

// User-related routes
require('./user')(app, db);
require('./chat')(app, chatDb, db);

app.get('/debug', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(__dirname + '/debug.html');
});

app.listen(port, () => {
  console.log(`Crystalchat Server listening on port ${port}`)
});

