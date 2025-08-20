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

app.listen(port, () => {
  console.log(`Crystalchat Server listening on port ${port}`)
})
