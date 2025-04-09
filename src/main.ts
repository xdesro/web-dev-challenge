import { WebSocketClientTransport } from '@replit/river/transport/ws/client';
import { createClient } from '@replit/river';
import { nanoid } from 'nanoid';
import { PerfectCursor } from "perfect-cursors";
import Peer, { MediaConnection } from 'peerjs';
import type { ServiceSurface } from '../server/index';
import { Static } from '@sinclair/typebox';
import { CursorStateSchema } from '../server/listener';
import { renderCursor } from './cursor';

const clientID = `client-${nanoid()}`;
const transport = new WebSocketClientTransport(
  async () => new WebSocket('wss://cursor-proximity-chat.replit.app/ws'),
  clientID,
);

const client = createClient<ServiceSurface>(
  transport,
  'SERVER',
  { eagerlyConnect: true },
);

const { reqWritable, resReadable } = client.room.join.stream({});
const me: Static<typeof CursorStateSchema> = {
  id: clientID,
  x: 0,
  y: 0,
};

const localCursorData = new Map<string, {
  interp: PerfectCursor;
  dialed: boolean;
  call?: MediaConnection;
}>();

const peer = new Peer(clientID, {
  host: "cursor-proximity-chat.replit.app",
  port: 9000,
  path: "/audio",
});

peer.on('call', async (call) => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  console.log('got call from', call.peer);
  call.answer(stream);

  call.on('stream', (remoteStream) => {
    console.log('streaming', call.peer);
    const audioEl = document.getElementById(`audio-${call.peer}`) as HTMLAudioElement;
    if (!audioEl) return;
    audioEl.srcObject = remoteStream;
  });
});

let sendUpdate = false
document.addEventListener('mousemove', (e) => {
  if (me.x !== e.pageX && me.y !== e.pageY) {
    sendUpdate = true
    me.x = e.pageX
    me.y = e.pageY
  }
});

setInterval(() => {
  if (sendUpdate) {
    reqWritable.write(me);
    sendUpdate = false
  }
}, 100);

window.addEventListener('beforeunload', () => {
  peer.destroy();
  reqWritable.close();
  transport.close();
});

// arbitrary tie breaker to determine initiator
const isInitiator = (other: string) => {
  return other.localeCompare(clientID) < 0
}

const cursorContainer = document.getElementById('cursor-container')!;
(async () => {
  for await (const update of resReadable) {
    if (!update.ok) return;

    const id = update.payload.body.id;
    if (id === clientID) continue;

    switch (update.payload.type) {
      case 'join':
        const cursorEl = renderCursor(id, 'red');
        cursorContainer.appendChild(cursorEl);
        const addPointClosure = ([x, y]: number[]) => cursorEl.style.setProperty("transform", `translate(${x}px, ${y}px)`);
        const perfectCursor = new PerfectCursor(addPointClosure);
        localCursorData.set(id, { interp: perfectCursor, dialed: false });
        break;
      case 'update':
        const { x, y } = update.payload.body;
        const cursorData = localCursorData.get(id);
        if (!cursorData) continue;

        cursorData.interp.addPoint([x, y]);

        // euclidean distance between cursor and me to determine call
        const distance = Math.sqrt((x - me.x) ** 2 + (y - me.y) ** 2);

        // scale volume + opacity
        const volume = Math.max(0, 1 - distance / 100);
        const opacity = Math.max(0.3, 1 - distance / 100);
        const el = document.getElementById(`cursor-${id}`);
        if (el) {
          el.style.opacity = opacity.toString();
        }

        if (distance < 100) {
          // call if we are initiator
          if (isInitiator(id) && !cursorData.dialed) {
            console.log('dialing', id);
            cursorData.dialed = true;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            const call = peer.call(id, stream);
            cursorData.call = call;
            call.on('stream', (remoteStream) => {
              console.log('streaming', id);
              const audioEl = document.getElementById(`audio-${id}`) as HTMLAudioElement;
              if (!audioEl) return;
              audioEl.srcObject = remoteStream;
              audioEl.volume = volume;
            });
          }

          if (cursorData.call) {
            const audioEl = document.getElementById(`audio-${id}`) as HTMLAudioElement;
            if (!audioEl) return;
            audioEl.volume = volume;
          }
        } else if (cursorData.call) {
          // remove call if we are now too far away
          cursorData.call.close();
          cursorData.call = undefined;
        }
        break;
      case 'leave':
        const oldCursorEl = cursorContainer.querySelector(`#cursor-${id}`);
        if (!oldCursorEl) continue;

        // if call exists, end it
        const oldCursorData = localCursorData.get(id);
        if (oldCursorData?.call) {
          oldCursorData.call.close();
          oldCursorData.call = undefined;
        }

        oldCursorEl.remove();
        localCursorData.delete(id);
        break;
    }
  }
})();
