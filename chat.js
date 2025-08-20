module.exports = function(app, chatDb, userdb) {
    console.log('Chat module loaded');

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

    // Example endpoint: get all chats
    app.get('/api/chats', (req, res) => {
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