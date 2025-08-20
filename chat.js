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

    // Example endpoint: get all chats (admin only)
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

    // Additional chat endpoints can be added here
};