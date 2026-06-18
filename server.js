const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.json({ ok: true, service: 'pengedag-video-motor', version: '1.4.5' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const rooms = new Map();
function getRoom(id) {
  const roomId = String(id || 'demo').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'demo';
  if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Set(), busy: false, activeSince: null, lastKnock: null });
  return { roomId, room: rooms.get(roomId) };
}
function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcast(room, data, except = null) {
  for (const c of room.clients) if (c !== except) send(c, data);
}
function roomStatus(roomId, room) {
  const roles = Array.from(room.clients).map(c => ({ role: c.role, name: c.name || c.role }));
  return { type: 'room-status', roomId, busy: room.busy, activeSince: room.activeSince, roles };
}
function oppositeRole(role) { return role === 'owner' ? 'employee' : 'owner'; }
function findTarget(room, role) { return Array.from(room.clients).find(c => c.role === oppositeRole(role)); }

wss.on('connection', (ws) => {
  ws.role = 'guest';
  ws.name = 'Pengedag';
  ws.roomId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: 'Ugyldig JSON' }); }

    if (msg.type === 'join') {
      const { roomId, room } = getRoom(msg.roomId);
      ws.roomId = roomId;
      ws.role = msg.role === 'owner' ? 'owner' : 'employee';
      ws.name = String(msg.name || ws.role).slice(0, 80);
      room.clients.add(ws);
      send(ws, { type: 'joined', roomId, role: ws.role, busy: room.busy });
      broadcast(room, roomStatus(roomId, room));
      return;
    }

    if (!ws.roomId || !rooms.has(ws.roomId)) return send(ws, { type: 'error', message: 'Ikke forbundet til rum' });
    const room = rooms.get(ws.roomId);
    const target = findTarget(room, ws.role);

    if (msg.type === 'knock') {
      room.lastKnock = { at: new Date().toISOString(), from: ws.name, role: ws.role };
      send(target, { type: 'knock', from: ws.name, role: ws.role, roomId: ws.roomId, message: `${ws.name} banker på` });
      send(ws, { type: 'waiting', message: 'Du banker på. Vent på svar.' });
      return;
    }

    if (msg.type === 'call-started') {
      room.busy = true;
      room.activeSince = new Date().toISOString();
      broadcast(room, roomStatus(ws.roomId, room));
      return;
    }

    if (msg.type === 'call-ended') {
      room.busy = false;
      room.activeSince = null;
      broadcast(room, { type: 'call-ended', by: ws.name });
      broadcast(room, roomStatus(ws.roomId, room));
      return;
    }

    if (['offer', 'answer', 'ice-candidate'].includes(msg.type)) {
      if (msg.type === 'offer' && room.busy) {
        send(target, { type: 'knock', from: ws.name, role: ws.role, roomId: ws.roomId, message: `${ws.name} vil ind i opkaldet` });
        send(ws, { type: 'waiting', message: 'Der er optaget. Du banker på.' });
        return;
      }
      if (!target) return send(ws, { type: 'waiting', message: 'Den anden part er ikke online endnu.' });
      send(target, { ...msg, from: ws.name, role: ws.role });
      return;
    }
  });

  ws.on('close', () => {
    if (!ws.roomId || !rooms.has(ws.roomId)) return;
    const room = rooms.get(ws.roomId);
    room.clients.delete(ws);
    if (room.clients.size === 0) rooms.delete(ws.roomId);
    else broadcast(room, roomStatus(ws.roomId, room));
  });
});

server.listen(PORT, () => console.log(`Pengedag video motor v1.4.5 on ${PORT}`));
