module.exports = function(app, chatDb, userdb) {
    console.log('Chat module loaded');

    // Middleware to check admin token
    function requireAdminToken(req, res, next) {
        const token = req.headers['authorization'] || req.body.token;
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        userdb.get(
            'SELECT is_admin FROM user WHERE token = ?',
            [token],
            (err, row) => {
                if (err) {
                    console.error('DB error in admin auth:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!row || !row.is_admin) {
                    return res.status(403).json({ error: 'Admin privileges required' });
                }
                next();
            }
        );
    }

    // Middleware to check user token and not banned
    function requireUserToken(req, res, next) {
        const token = req.headers['authorization'] || req.body.token || req.body.usertoken;
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        userdb.get(
            'SELECT rowid, username, is_banned FROM user WHERE token = ?',
            [token],
            (err, row) => {
                if (err) {
                    console.error('DB error in user auth:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!row) {
                    return res.status(401).json({ error: 'Invalid token' });
                }
                if (row.is_banned) {
                    return res.status(403).json({ error: 'User is banned' });
                }
                req.user = row;
                next();
            }
        );
    }

    // Serialize chat row to object (now uses usernames)
    function serializeChat(row) {
        return {
            ID: row.id,
            name: row.name,
            icon: row.icon,
            memberUsernames: JSON.parse(row.member_ids),
            description: row.description,
            adminUsernames: JSON.parse(row.admin_ids),
            bannedUsernames: JSON.parse(row.banned_user_ids),
            IsDM: Boolean(row.is_dm)
        };
    }

    // get all chats (admin only)
    app.get('/api/chats', requireAdminToken, (req, res) => {
        chatDb.all('SELECT * FROM chat', [], (err, rows) => {
            if (err) {
                console.error('DB error in /api/chats:', err);
                res.status(500).json({ error: 'Database error' });
                return;
            }
            const chats = rows.map(serializeChat);
            res.json(chats);
        });
    });

    // create a new chat (group or DM)
    app.post('/api/newchat', requireUserToken, (req, res) => {
        const creatorUsername = req.user.username;
        const { isdm, chatname, description } = req.body;

        // DM chat creation
        if (isdm && typeof isdm === 'string') {
            // Prevent DM to self
            if (isdm === creatorUsername) {
                return res.status(400).json({ error: 'Cannot create DM with yourself' });
            }
            // Check if the other user exists
            userdb.get('SELECT username FROM user WHERE username = ?', [isdm], (err, userRow) => {
                if (err) {
                    console.error('DB error in /api/newchat (user check):', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!userRow) {
                    return res.status(404).json({ error: 'Target user does not exist' });
                }
                // Check if DM already exists between these two users
                chatDb.get(
                    `SELECT * FROM chat WHERE is_dm = 1 AND (
                        (json_extract(member_ids, '$[0]') = ? AND json_extract(member_ids, '$[1]') = ?)
                        OR
                        (json_extract(member_ids, '$[0]') = ? AND json_extract(member_ids, '$[1]') = ?)
                    )`,
                    [creatorUsername, isdm, isdm, creatorUsername],
                    (err, row) => {
                        if (err) {
                            console.error('DB error in /api/newchat (dm check):', err);
                            return res.status(500).json({ error: 'Database error' });
                        }
                        if (row) {
                            return res.status(409).json({ error: 'DM chat already exists' });
                        }
                        // DM chat name: "name1 - name2" (sorted for consistency)
                        const sortedNames = [creatorUsername, isdm].sort();
                        const dmName = `${sortedNames[0]} - ${sortedNames[1]}`;
                        const memberUsernames = JSON.stringify([creatorUsername, isdm]);
                        const adminUsernames = JSON.stringify([creatorUsername]);
                        const bannedUsernames = JSON.stringify([]);
                        chatDb.run(
                            `INSERT INTO chat (name, icon, member_ids, description, admin_ids, banned_user_ids, is_dm)
                             VALUES (?, ?, ?, ?, ?, ?, 1)`,
                            [dmName, null, memberUsernames, null, adminUsernames, bannedUsernames],
                            function(err) {
                                if (err) {
                                    console.error('DB error in /api/newchat (dm insert):', err);
                                    return res.status(500).json({ error: 'Database error' });
                                }
                                res.status(201).json({
                                    id: this.lastID,
                                    isdm: true,
                                    name: dmName,
                                    members: [creatorUsername, isdm]
                                });
                            }
                        );
                    }
                );
            });
        } else {
            // Group chat creation
            if (!chatname || typeof chatname !== 'string' || !chatname.trim()) {
                return res.status(400).json({ error: 'Chat name required for group chat' });
            }
            const memberUsernames = JSON.stringify([creatorUsername]);
            const adminUsernames = JSON.stringify([creatorUsername]);
            const bannedUsernames = JSON.stringify([]);
            chatDb.run(
                `INSERT INTO chat (name, icon, member_ids, description, admin_ids, banned_user_ids, is_dm)
                 VALUES (?, ?, ?, ?, ?, ?, 0)`,
                [chatname, null, memberUsernames, description || null, adminUsernames, bannedUsernames],
                function(err) {
                    if (err) {
                        console.error('DB error in /api/newchat (group insert):', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.status(201).json({
                        id: this.lastID,
                        name: chatname,
                        description: description || null,
                        isdm: false,
                        members: [creatorUsername],
                        admins: [creatorUsername]
                    });
                }
            );
        }
    });

    // Get all chats the authenticated user is a member of
    app.get('/api/mychats', requireUserToken, (req, res) => {
        const username = req.user.username;
        chatDb.all('SELECT * FROM chat', [], (err, rows) => {
            if (err) {
                console.error('DB error in /api/mychats:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            const userChats = rows.filter(row => {
                try {
                    const members = JSON.parse(row.member_ids);
                    return Array.isArray(members) && members.includes(username);
                } catch {
                    return false;
                }
            }).map(serializeChat);
            res.json(userChats);
        });
    });
};