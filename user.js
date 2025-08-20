module.exports = function(app, db) {
    console.log('User module loaded');
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
        console.error('DB error in /api/users:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      const users = rows.map(serializeUser);
      res.json(users);
    });
  });

  app.post('/api/register', (req, res) => {
    const { username, password } = req.body;

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

    db.get('SELECT username FROM user WHERE username = ?', [username], (err, row) => {
      if (err) {
        console.error('DB error in /api/register (select):', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      if (row) {
        res.status(409).json({ error: 'Username already exists' });
        return;
      }

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
            console.error('DB error in /api/register (insert):', err);
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
          console.error('DB error in /api/gettoken:', err);
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

  app.post('/api/whoami', (req, res) => {
    const { token } = req.body;
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }
    db.get(
      'SELECT username, registration_time, token, is_banned, is_admin, avatar_id, last_online FROM user WHERE token = ?',
      [token],
      (err, row) => {
        if (err) {
          console.error('DB error in /api/whoami:', err);
          res.status(500).json({ error: 'Database error' });
          return;
        }
        if (!row) {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }
        res.json({
          username: row.username,
          registrationTime: row.registration_time,
          token: row.token,
          IsBanned: Boolean(row.is_banned),
          IsAdmin: Boolean(row.is_admin),
          AvatarID: row.avatar_id === null ? null : row.avatar_id,
          LastOnline: row.last_online === null ? null : row.last_online
        });
      }
    );
  });
};
