import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// simple status endpoint to inspect active rooms and socket count
app.get('/_status', (req, res) => {
  try {
    const sockets = io.sockets.sockets ? io.sockets.sockets.size || Object.keys(io.sockets.sockets).length : 0;
    res.json({ ok: true, rooms: activeRooms.length, sockets });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

// debug endpoint - returns detailed activeRooms and socket ids
app.get('/_debug', (req, res) => {
  try {
    const socketsMap = io.sockets.sockets || {};
    const socketIds = Array.isArray(socketsMap) ? socketsMap.map(s => s.id) : Object.keys(socketsMap);
    const rooms = activeRooms.map(r => ({ roomId: r.roomId, users: r.users }));
    res.json({ ok: true, rooms, socketIds });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

// force-disconnect endpoint for admin/debugging
app.post('/_disconnect', (req, res) => {
  const { socketId } = req.body || {};
  if (!socketId) return res.status(400).json({ ok: false, error: 'socketId required' });
  try {
    const s = io.sockets.sockets.get ? io.sockets.sockets.get(socketId) : (io.sockets.sockets || {})[socketId];
    if (!s) return res.status(404).json({ ok: false, error: 'socket not found' });
    s.disconnect(true);
    return res.json({ ok: true, disconnected: socketId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// track recent connect frequency per remote address to detect reconnect storms
const connectHistory = new Map(); // addr -> [timestamps]
function recordConnect(addr) {
  try {
    const now = Date.now();
    const arr = connectHistory.get(addr) || [];
    arr.push(now);
    // keep last 60s
    const cutoff = now - 60_000;
    const pruned = arr.filter(t => t >= cutoff);
    connectHistory.set(addr, pruned);
    return pruned.length;
  } catch (e) { return 0; }
}

// simple temporary blacklist for abusive reconnectors: addr -> expiresAt
const blacklist = new Map();
function isBlacklisted(addr) {
  const exp = blacklist.get(addr);
  if (!exp) return false;
  if (Date.now() > exp) { blacklist.delete(addr); return false; }
  return true;
}
function addToBlacklist(addr, ttl = 1000 * 60) {
  blacklist.set(addr, Date.now() + ttl);
  // clear recorded history for addr to avoid unbounded growth
  connectHistory.delete(addr);
}

// In-memory active rooms store
const activeRooms = [];
// { roomId, lat, lng, users: [] }

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const MAX_DISTANCE_KM = 0.5;
const MAX_USERS_PER_ROOM = 50;

app.post('/join-network', (req, res) => {
  const { lat, lng, username } = req.body || {};

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const room = { roomId, lat: 0, lng: 0, users: [] };
    activeRooms.push(room);
    res.json({ roomId });
    return;
  }

  // Prefer only rooms that currently have active users; do not reuse empty rooms
  let room = activeRooms.find(r =>
    getDistance(lat, lng, r.lat, r.lng) < MAX_DISTANCE_KM &&
    r.users.length > 0 &&
    r.users.length < MAX_USERS_PER_ROOM
  );

  if (!room) {
    room = {
      roomId: `room-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      lat,
      lng,
      users: [],
      sos: [],
      messages: [],
      createdAt: Date.now()
    };
    activeRooms.push(room);
  }

  // NOTE: Do not mutate room.users here — the socket layer is authoritative for presence

  res.json({ roomId: room.roomId });
});

io.on('connection', (socket) => {
  const addr = socket.handshake && socket.handshake.address ? socket.handshake.address : (socket.request && socket.request.connection ? socket.request.connection.remoteAddress : 'unknown');
  if (isBlacklisted(addr)) {
    console.warn('Rejecting connection from blacklisted addr', addr);
    try { socket.disconnect(true); } catch (e) {}
    return;
  }
  const recent = recordConnect(addr);
  console.log('socket connected', socket.id, 'from', addr, 'recentConnectionsLast60s=', recent, 'totalSockets=', io.sockets.sockets ? (io.sockets.sockets.size || Object.keys(io.sockets.sockets).length) : 'unknown');
  if (recent > 100) {
    console.warn('High connect frequency from', addr, 'count=', recent, ' — temporarily blacklisting');
    addToBlacklist(addr, 1000 * 60); // blacklist for 60s
    try { socket.disconnect(true); } catch (e) {}
    return;
  } else if (recent > 10) {
    console.warn('High connect frequency from', addr, 'count=', recent);
  }

  // Client asks to join a nearby network zone
  socket.on('join-network', ({ lat, lng, username } = {}) => {
    // Find an existing nearby room with active users (do NOT reuse empty rooms)
    let room = activeRooms.find(r =>
      typeof lat === 'number' && typeof lng === 'number' &&
      getDistance(lat, lng, r.lat, r.lng) < MAX_DISTANCE_KM &&
      r.users.length > 0 &&
      r.users.length < MAX_USERS_PER_ROOM
    );

    if (!room) {
      // No active nearby room found; create a fresh room for this join
      room = {
        roomId: `room-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        lat: typeof lat === 'number' ? lat : 0,
        lng: typeof lng === 'number' ? lng : 0,
        users: [],
        sos: [],
        messages: [],
        createdAt: Date.now()
      };
      activeRooms.push(room);
    }

    // remember username on socket for use by other events (peer discovery, etc.)
    socket.username = username || `u-${socket.id.slice(0,6)}`;

    // Add socket user to the room if not already present
    const existing = room.users.find(u => u.id === socket.id);
    if (!existing) {
      room.users.push({ id: socket.id, username: username || `u-${socket.id.slice(0,6)}`, joinedAt: Date.now() });
    }

    socket.join(room.roomId);

    // Notify the joining client of the assigned room
    socket.emit('room-assigned', room.roomId);

    // If client has shared a PeerJS id earlier, we will relay peer availability when shared

    // Broadcast to other room members that someone joined
    socket.to(room.roomId).emit('user-joined', { username: username || 'unknown', count: room.users.length });
    // Also emit a system message for joins and store it in room.messages
    const joinMsg = { id: `sys-${Date.now()}`, text: `${username || 'Someone'} joined the network`, type: 'join', username: username || 'unknown', ts: Date.now() };
    room.messages.push(joinMsg);
    io.to(room.roomId).emit('system-message', { text: joinMsg.text, type: 'join', username: joinMsg.username });
  });

  // Allow explicit join to a specific room id (used by rescuer dashboard)
  socket.on('join-zone', ({ roomId, username } = {}) => {
    try {
      const room = activeRooms.find(r => r.roomId === roomId);
      if (!room) {
        // If room not found, still create a placeholder room so rescuer can enter for monitoring
        const newRoom = { roomId: roomId || `room-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, lat: 0, lng: 0, users: [], sos: [], messages: [], createdAt: Date.now() };
        activeRooms.push(newRoom);
      }
      socket.join(roomId);
      socket.username = username || socket.username || `u-${socket.id.slice(0,6)}`;
      // add to users list if not already present
      const r = activeRooms.find(r => r.roomId === roomId);
      if (r) {
        const exists = r.users.find(u => u.id === socket.id);
        if (!exists) r.users.push({ id: socket.id, username: socket.username, joinedAt: Date.now() });
      }
      socket.emit('room-assigned', roomId);
      socket.to(roomId).emit('user-joined', { username: socket.username, count: r ? r.users.length : 1 });
    } catch (e) { console.warn('join-zone failed', e); }
  });

  // Peer discovery: clients can share their PeerJS id while online
  socket.on('share-peer-id', (peerId) => {
    // relay to other members in the same rooms that a peer is available
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    rooms.forEach(rid => {
      socket.to(rid).emit('peer-available', { peerId, username: socket.username });
    });
  });

  // SOS updates from clients
  socket.on('sos-update', (data = {}) => {
    // data: { userId, username, lat, lng, priority, active }
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    rooms.forEach(rid => {
      const room = activeRooms.find(r => r.roomId === rid);
      if (room) {
        // update or add sos in room.sos
        const existing = room.sos.find(s => s.userId === data.userId || s.username === data.username);
        const sosObj = {
          userId: data.userId || socket.id,
          username: data.username || 'unknown',
          lat: data.lat,
          lng: data.lng,
          priority: data.priority || 'low',
          active: data.active !== undefined ? data.active : true,
          ts: Date.now(),
        };
        if (existing) {
          Object.assign(existing, sosObj);
        } else {
          room.sos.push(sosObj);
        }
        io.to(rid).emit('sos-update', sosObj);
      } else {
        io.to(rid).emit('sos-update', data);
      }
    });
  });

  socket.on('sos-cleared', (data = {}) => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    rooms.forEach(rid => {
      const room = activeRooms.find(r => r.roomId === rid);
      if (room) {
        room.sos = room.sos.map(s => (s.userId === data.userId || s.username === data.username) ? { ...s, active: false } : s);
      }
      io.to(rid).emit('sos-cleared', data);
    });
  });

  socket.on('monitor:rooms', () => {
    socket.emit('rooms',
      activeRooms.map(r => ({
        roomId: r.roomId,
        users: r.users.length
      }))
    );
  });

  // Clean up on disconnect: remove user from any rooms and notify peers
  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
    for (let i = activeRooms.length - 1; i >= 0; i--) {
      const room = activeRooms[i];
      const before = room.users.length;
      const leaving = room.users.find(u => u.id === socket.id);
      room.users = room.users.filter(u => u.id !== socket.id);
      if (room.users.length !== before) {
        // notify remaining members
        io.to(room.roomId).emit('user-left', { id: socket.id, username: leaving?.username || 'unknown', userId: socket.id });
        // emit system message and store
        const leaveMsg = { id: `sys-${Date.now()}`, text: `${leaving?.username || 'Someone'} left the network`, type: 'leave', username: leaving?.username || 'unknown', ts: Date.now() };
        room.messages.push(leaveMsg);
        io.to(room.roomId).emit('system-message', { text: leaveMsg.text, type: 'leave', username: leaveMsg.username });
        // mark their SOS alerts inactive for others and update room.sos
        room.sos = room.sos.map(s => (s.userId === socket.id || s.username === leaving?.username) ? { ...s, active: false } : s);
        io.to(room.roomId).emit('sos-cleared', { userId: socket.id, username: leaving?.username || 'unknown' });
      }

      // If room now empty, remove it immediately and drop all data
      if (room.users.length === 0) {
        activeRooms.splice(i, 1);
      }
    }
    console.log('after disconnect totalRooms=', activeRooms.length);
  });
});

setInterval(() => {
  const TTL = 1000 * 60 * 30;
  const now = Date.now();

  for (let i = activeRooms.length - 1; i >= 0; i--) {
    const r = activeRooms[i];
    if (r.users.length === 0 && (now - (r.createdAt || now)) > TTL) {
      activeRooms.splice(i, 1);
    }
  }
}, 1000 * 60 * 5);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Location-room server listening on ${PORT}`);
});

app.get('/_blacklist', (req, res) => {
  try {
    const list = Array.from(blacklist.entries()).map(([addr, exp]) => ({ addr, expiresAt: exp }));
    res.json({ ok: true, list });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// Return a zones summary for rescuer dashboard
app.get('/zones', (req, res) => {
  try {
    // Accept optional query params: lat, lng, radiusKm
    const latQ = parseFloat(req.query.lat);
    const lngQ = parseFloat(req.query.lng);
    const radiusKm = req.query.radius ? parseFloat(req.query.radius) : 10; // default 10km radius

    const mapped = activeRooms.map(r => {
      const sosCounts = { critical: 0, medium: 0, low: 0 };
      if (Array.isArray(r.sos)) {
        r.sos.forEach(s => {
          if (!s || s.active === false) return;
          const p = (s.priority || '').toString().toLowerCase();
          if (p === 'high' || p === 'critical') sosCounts.critical += 1;
          else if (p === 'medium' || p === 'med') sosCounts.medium += 1;
          else sosCounts.low += 1;
        });
      }
      return {
        roomId: r.roomId,
        lat: r.lat,
        lng: r.lng,
        userCount: Array.isArray(r.users) ? r.users.length : 0,
        lastActivity: (r.messages && r.messages.length) ? (r.messages[r.messages.length - 1].ts || r.messages[r.messages.length - 1].timestamp || 0) : (r.createdAt || 0),
        sosCount: sosCounts,
      };
    });

    let zones = mapped;
    // If lat/lng filter provided, return only zones within radiusKm
    if (!isNaN(latQ) && !isNaN(lngQ)) {
      zones = mapped.filter(z => {
        if (typeof z.lat !== 'number' || typeof z.lng !== 'number') return false;
        const d = getDistance(latQ, lngQ, z.lat, z.lng);
        return d <= radiusKm;
      });
    }

    // If no zones found nearby, fall back to returning all active zones (no mocking by default)
    if (!zones || zones.length === 0) {
      zones = mapped;
    }

    res.json(zones);
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});