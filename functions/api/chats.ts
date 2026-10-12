import { Hono } from 'hono';
import { requireAuth } from '../lib/userAuth';

type Bindings = {
    DB: D1Database;
};

const chats = new Hono<{ Bindings: Bindings; Variables: { user: any } }>();

// Chats are private: a room is visible to its two participants (and admins) only.
chats.use('*', requireAuth);

const isParticipant = (room: any, userId: string) => room.user1_id === userId || room.user2_id === userId;

// Create chats table if it doesn't exist
const ensureTable = async (db: D1Database) => {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS chat_rooms (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            user1_id TEXT NOT NULL,
            user2_id TEXT NOT NULL,
            last_message TEXT DEFAULT '',
            last_message_at TEXT DEFAULT (datetime('now')),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);
    await db.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            room_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (room_id) REFERENCES chat_rooms(id)
        )
    `);
};

// List chat rooms for the current user
chats.get('/', async (c) => {
    const db = c.env.DB;
    await ensureTable(db);

    // The signed-in user's rooms; only an admin may list another user's.
    const user = c.get('user');
    const requested = c.req.query('user_id');
    const userId = user.role === 'admin' && requested ? requested : user.id;

    try {
        const { results } = await db.prepare(
            `SELECT * FROM chat_rooms 
             WHERE user1_id = ? OR user2_id = ? 
             ORDER BY last_message_at DESC`
        ).bind(userId, userId).all();

        return c.json(results || []);
    } catch (error) {
        console.error('Error fetching chat rooms:', error);
        return c.json([]);
    }
});

// Get a single chat room
chats.get('/:id', async (c) => {
    const db = c.env.DB;
    await ensureTable(db);
    const id = c.req.param('id');

    try {
        const room = await db.prepare('SELECT * FROM chat_rooms WHERE id = ?').bind(id).first();
        if (!room) {
            return c.json({ error: 'Room not found' }, 404);
        }
        const user = c.get('user');
        if (user.role !== 'admin' && !isParticipant(room, user.id)) {
            return c.json({ error: 'Forbidden' }, 403);
        }
        return c.json(room);
    } catch (error) {
        console.error('Error fetching chat room:', error);
        return c.json({ error: 'Failed to fetch room' }, 500);
    }
});

// Create or find existing chat room
chats.post('/', async (c) => {
    const db = c.env.DB;
    await ensureTable(db);

    try {
        const body = await c.req.json();
        const { partner_id } = body;
        // The room is always opened by the signed-in user, whatever the body says.
        const user_id = c.get('user').id;

        if (!partner_id || partner_id === user_id) {
            return c.json({ error: 'partner_id is required' }, 400);
        }

        // Check if room already exists between these two users
        const existingRoom = await db.prepare(
            `SELECT * FROM chat_rooms 
             WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`
        ).bind(user_id, partner_id, partner_id, user_id).first();

        if (existingRoom) {
            return c.json(existingRoom);
        }

        // Create new room
        const id = crypto.randomUUID().replace(/-/g, '');
        await db.prepare(
            `INSERT INTO chat_rooms (id, user1_id, user2_id) VALUES (?, ?, ?)`
        ).bind(id, user_id, partner_id).run();

        const newRoom = await db.prepare('SELECT * FROM chat_rooms WHERE id = ?').bind(id).first();
        return c.json(newRoom);
    } catch (error) {
        console.error('Error creating chat room:', error);
        return c.json({ error: 'Failed to create chat room' }, 500);
    }
});

export default chats;
