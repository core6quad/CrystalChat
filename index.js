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
  }
});

require('dotenv').config()
const port = process.env.port || 3000
const version = process.env.version || '1.0.0'


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
    IsBanned: !!row.is_banned,
    IsAdmin: !!row.is_admin,
    AvatarID: row.avatar_id,
    LastOnline: row.last_online
  };
}

// Endpoint to get all users serialized
app.get('/api/users', (req, res) => {
  db.all('SELECT username, password, registration_time, token, is_banned, is_admin, avatar_id, last_online FROM user', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    const users = rows.map(serializeUser);
    res.json(users);
  });
});

app.listen(port, () => {
  console.log(`Crystalchat Server listening on port ${port}`)
})
