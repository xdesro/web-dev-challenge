import http from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketServerTransport } from '@replit/river/transport/ws/server';
import { createServer } from '@replit/river';
import { RoomService } from './service';
import { PeerServer } from 'peer';

const httpServer = http.createServer();
const port = 5000;
const peerServerPort = 9000;
const wss = new WebSocketServer({ server: httpServer });
const transport = new WebSocketServerTransport(wss, 'SERVER');

export const services = {
  room: RoomService,
};

export type ServiceSurface = typeof services;
export const server = createServer(transport, services);

PeerServer({ port: peerServerPort, path: '/audio', proxied: true });
httpServer.listen(port);