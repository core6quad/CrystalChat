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

    // Serialize chat row to object
    function serializeChat(row) {
        return {
            ID: row.id,
            name: row.name,
            icon: row.icon,
            memberIDs: JSON.parse(row.member_ids),
            description: row.description,
            adminIDs: JSON.parse(row.admin_ids),
            bannedUserIDs: JSON.parse(row.banned_user_ids),
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
        const creatorId = req.user.rowid;
        const creatorUsername = req.user.username;
        const { isdm, chatname, description } = req.body;

        // DM chat creation
        if (isdm && typeof isdm === 'number') {
            // Prevent DM to self
            if (isdm === creatorId) {
                return res.status(400).json({ error: 'Cannot create DM with yourself' });
            }
            // Check if DM already exists between these two users
            chatDb.get(
                `SELECT * FROM chat WHERE is_dm = 1 AND (
                    (json_extract(member_ids, '$[0]') = ? AND json_extract(member_ids, '$[1]') = ?)
                    OR
                    (json_extract(member_ids, '$[0]') = ? AND json_extract(member_ids, '$[1]') = ?)
                )`,
                [creatorId, isdm, isdm, creatorId],
                (err, row) => {
                    if (err) {
                        console.error('DB error in /api/newchat (dm check):', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    if (row) {
                        return res.status(409).json({ error: 'DM chat already exists' });
                    }
                    // Create DM chat
                    const memberIds = JSON.stringify([creatorId, isdm]);
                    const adminIds = JSON.stringify([creatorId]);
                    const bannedUserIds = JSON.stringify([]);
                    chatDb.run(
                        `INSERT INTO chat (name, icon, member_ids, description, admin_ids, banned_user_ids, is_dm)
                         VALUES (?, ?, ?, ?, ?, ?, 1)`,
                        [null, null, memberIds, null, adminIds, bannedUserIds],
                        function(err) {
                            if (err) {
                                console.error('DB error in /api/newchat (dm insert):', err);
                                return res.status(500).json({ error: 'Database error' });
                            }
                            res.status(201).json({
                                id: this.lastID,
                                isdm: true,
                                members: [creatorId, isdm]
                            });
                        }
                    );
                }
            );
        } else {
            // Group chat creation
            if (!chatname || typeof chatname !== 'string' || !chatname.trim()) {
                return res.status(400).json({ error: 'Chat name required for group chat' });
            }
            const memberIds = JSON.stringify([creatorId]);
            const adminIds = JSON.stringify([creatorId]);
            const bannedUserIds = JSON.stringify([]);
            chatDb.run(
                `INSERT INTO chat (name, icon, member_ids, description, admin_ids, banned_user_ids, is_dm)
                 VALUES (?, ?, ?, ?, ?, ?, 0)`,
                [chatname, null, memberIds, description || null, adminIds, bannedUserIds],
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
                        members: [creatorId],
                        admins: [creatorId]
                    });
                }
            );
        }
    });

    // Get all chats the authenticated user is a member of
    app.get('/api/mychats', requireUserToken, (req, res) => {
        const userId = req.user.rowid;
        chatDb.all('SELECT * FROM chat', [], (err, rows) => {
            if (err) {
                console.error('DB error in /api/mychats:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            const userChats = rows.filter(row => {
                try {
                    const members = JSON.parse(row.member_ids);
                    return Array.isArray(members) && members.includes(userId);
                } catch {
                    return false;
                }
            }).map(serializeChat);
            res.json(userChats);
        });
    });
};