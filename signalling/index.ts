import { PeerServer } from "peer";

PeerServer({
  port: 3000,
  path: "/",
  allow_discovery: true,
  proxied: true,
});

console.log(`peer server running on localhost:3000`);