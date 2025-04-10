import http from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketServerTransport } from '@replit/river/transport/ws/server';
import { createServer } from '@replit/river';
import { RoomService } from './service';

const httpServer = http.createServer();
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const transport = new WebSocketServerTransport(wss, 'SERVER');

export const services = {
  room: RoomService,
};

export type ServiceSurface = typeof services;
export const riverServer = createServer(transport, services);

httpServer.listen(5000, () => {
  console.log(`wss server running on localhost:5000`);
});

httpServer.on("request", (req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  }
});
