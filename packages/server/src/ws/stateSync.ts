import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { WSMessage } from '@botville/shared';
import { userIdFromUpgrade } from '../auth/session.js';

const clients = new Map<string, Set<WebSocket>>();

export function createWSSServer(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // userId comes only from a signed value: the upgrade request's cookie or
    // the `?token=` token (cross-site, TZ-12). A raw id from the client is
    // never accepted.
    const userId = userIdFromUpgrade(req);
    if (!userId) {
      ws.close(4001, 'valid session cookie or token required');
      return;
    }
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(ws);

    ws.on('close', () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
    });

    ws.send(JSON.stringify({ type: 'world:state', payload: { agents: [], timestamp: Date.now() } }));
  });
}

export function broadcastToUser(userId: string, message: WSMessage) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const data = JSON.stringify(message);
  userClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}
