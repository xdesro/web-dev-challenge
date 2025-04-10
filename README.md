## deployments

- wss state sync is deployed to `cursor-proximity-chat.replit.app` at port 80
- webrtc signalling server is deployed to `peerjs-server.replit.app` at port 3000

## scripts

- local dev with everything: `npm run all`
- build for prod: `npm run site:build` -> output to `dist`
- just the website using deployed services: `npm run site:dev`
- just the signalling server: `npm run signalling`
- just the wss server: `npm run server`
