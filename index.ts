import http from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketServerTransport } from '@replit/river/transport/ws/server';
import { createServer } from '@replit/river';
import { RoomService } from './service';
import { coloredStringLogger } from '@replit/river/logging';

const httpServer = http.createServer();
const port = 5000;
const wss = new WebSocketServer({ server: httpServer });
const transport = new WebSocketServerTransport(wss, 'SERVER');
transport.bindLogger(coloredStringLogger);

export const server = createServer(transport, {
  room: RoomService,
});

httpServer.listen(port);