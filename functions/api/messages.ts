import { Hono } from 'hono';
import { requireAuth } from '../lib/userAuth';

type Bindings = {
    DB: D1Database;
};

const messages = new Hono<{ Bindings: Bindings; Variables: { user: any } }>();

// Messages are private: only the two participants of a room (and admins) may read or post.
messages.use('*', requireAuth);

/** 'ok' when the user may use the room, otherwise the reason. Throws on database errors. */
const roomAccess = async (db: D1Database, roomId: string, user: any): Promise<'ok' | 'missing' | 'forbidden'> => {
    const room = await db.prepare('SELECT user1_id, user2_id FROM chat_rooms WHERE id = ?').bind(roomId).first<{ user1_id: string; user2_id: string }>();
    if (!room) return 'missing';
    if (user.role === 'admin' || room.user1_id === user.id || room.user2_id === user.id) return 'ok';
    return 'forbidden';
};

// List messages for a chat room
messages.get('/', async (c) => {
    const db = c.env.DB;
    const roomId = c.req.query('room_id');

    if (!roomId) {
        return c.json([]);
    }

    try {
        const access = await roomAccess(db, roomId, c.get('user'));
        if (access === 'missing') return c.json([]);
        if (access === 'forbidden') return c.json({ error: 'Forbidden' }, 403);

        const { results } = await db.prepare(
            `SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at ASC`
        ).bind(roomId).all();

        return c.json(results || []);
    } catch (error) {
        console.error('Error fetching messages:', error);
        return c.json([]);
    }
});

// Send a message
messages.post('/', async (c) => {
    const db = c.env.DB;

    try {
        const body = await c.req.json();
        const { room_id, content } = body;
        // The sender is always the signed-in user, whatever the body says.
        const user = c.get('user');
        const sender_id = user.id;

        if (!room_id || !content) {
            return c.json({ error: 'room_id and content are required' }, 400);
        }

        const access = await roomAccess(db, room_id, user);
        if (access === 'missing') return c.json({ error: 'Room not found' }, 404);
        if (access === 'forbidden') return c.json({ error: 'Forbidden' }, 403);

        const id = crypto.randomUUID().replace(/-/g, '');
        await db.prepare(
            `INSERT INTO chat_messages (id, room_id, sender_id, content) VALUES (?, ?, ?, ?)`
        ).bind(id, room_id, sender_id, content).run();

        // Update last message in chat room
        await db.prepare(
            `UPDATE chat_rooms SET last_message = ?, last_message_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).bind(content, room_id).run();

        const newMessage = await db.prepare('SELECT * FROM chat_messages WHERE id = ?').bind(id).first();
        return c.json(newMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        return c.json({ error: 'Failed to send message' }, 500);
    }
});

export default messages;
