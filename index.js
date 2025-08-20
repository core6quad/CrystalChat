const express = require('express')
const sqlite3 = require('sqlite3').verbose();
const app = express()
const ws = require('ws')
const bodyParser = require('body-parser')
const cors = require('cors')


const db = new sqlite3.Database('./data/database.db', (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to the database');
    // Ensure user table exists with correct schema
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


require('dotenv').config()
const port = process.env.port || 3000
const version = process.env.version || '1.0.0'

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/api/version', (req, res) => {
  res.send(version)
})

// Serialize user row to object
function serializeUser(row) {
  return {
    username: row.username,
    password: row.password,
    registrationTime: row.registration_time,
    token: row.token,
    IsBanned: Boolean(row.is_banned),
    IsAdmin: Boolean(row.is_admin),
    AvatarID: row.avatar_id === null ? null : row.avatar_id,
    LastOnline: row.last_online === null ? null : row.last_online
  };
}

// Endpoint to get all users serialized
app.get('/api/users', (req, res) => {
  db.all('SELECT username, password, registration_time, token, is_banned, is_admin, avatar_id, last_online FROM user', [], (err, rows) => {
    if (err) {
      console.error('DB error in /api/users:', err); // log error
      res.status(500).json({ error: 'Database error' });
      return;
    }
    const users = rows.map(serializeUser);
    res.json(users);
  });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  // Validate username and password length
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length < 3 ||
    username.length > 16 ||
    password.length < 6 ||
    password.length > 24
  ) {
    res.status(400).json({ error: 'Invalid username or password length' });
    return;
  }

  // Check if username already exists
  db.get('SELECT username FROM user WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('DB error in /api/register (select):', err); // log error
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (row) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    // Generate random token
    const token = require('crypto').randomBytes(32).toString('hex');
    const registrationTime = Date.now();
    const isAdmin = 0;
    const isBanned = 0;
    const avatarId = null;
    const lastOnline = null;

    db.run(
      `INSERT INTO user (username, password, registration_time, token, is_banned, is_admin, avatar_id, last_online)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, password, registrationTime, token, isBanned, isAdmin, avatarId, lastOnline],
      function (err) {
        if (err) {
          console.error('DB error in /api/register (insert):', err); // log error
          res.status(500).json({ error: 'Database error' });
          return;
        }
        res.status(201).json({
          username,
          registrationTime,
          token,
          IsBanned: false,
          IsAdmin: false,
          AvatarID: null,
          LastOnline: null
        });
      }
    );
  });
});

app.post('/api/gettoken', (req, res) => {
  const { username, password } = req.body;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string'
  ) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  db.get(
    'SELECT token FROM user WHERE username = ? AND password = ?',
    [username, password],
    (err, row) => {
      if (err) {
        console.error('DB error in /api/gettoken:', err); // log error
        res.status(500).json({ error: 'Database error' });
        return;
      }
      if (!row) {
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }
      res.json({ token: row.token });
    }
  );
});

app.listen(port, () => {
  console.log(`Crystalchat Server listening on port ${port}`)
});
