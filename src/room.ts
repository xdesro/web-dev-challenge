import { WebSocketClientTransport } from "@replit/river/transport/ws/client";
import { createClient } from "@replit/river";
import { nanoid } from "nanoid";
import { PerfectCursor } from "perfect-cursors";
import Peer, { MediaConnection, PeerOptions } from "peerjs";
import type { ServiceSurface } from "../server/index";
import { Static } from "@sinclair/typebox";
import { CursorStateSchema } from "../server/listener";
import { renderCursor } from "./cursor";

const clientID = `client-${nanoid()}`;
const WS_URL = import.meta.env.VITE_LOCAL
  ? "ws://localhost:5000/ws"
  : "wss://cursor-proximity-chat.replit.app/ws";
const PEER_OPTIONS: PeerOptions = import.meta.env.VITE_LOCAL
  ? {
      host: "localhost",
      port: 3000,
      path: "/",
    }
  : {
      host: "peerjs-server.replit.app",
      path: "/",
      secure: true,
    };

const transport = new WebSocketClientTransport(
  async () => new WebSocket(WS_URL),
  clientID
);

const client = createClient<ServiceSurface>(transport, "SERVER", {
  eagerlyConnect: true,
});

async function start() {
  const { reqWritable, resReadable } = client.room.join.stream({});
  const me: Static<typeof CursorStateSchema> = {
    id: clientID,
    x: 0,
    y: 0,
    volume: 0,
  };

  const peer = new Peer(clientID, PEER_OPTIONS);
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });

  const localCursorData: Record<
    string,
    {
      interp: PerfectCursor;
      dialed: boolean;
      call?: MediaConnection;
      lastState: Static<typeof CursorStateSchema>;
    }
  > = {};

  const audioContext = new AudioContext();
  const mediaStreamAudioSourceNode =
    audioContext.createMediaStreamSource(localStream);
  const analyserNode = audioContext.createAnalyser();
  mediaStreamAudioSourceNode.connect(analyserNode);

  const pcmData = new Float32Array(analyserNode.fftSize);
  const getVolume = (): number => {
    analyserNode.getFloatTimeDomainData(pcmData);
    let sum = 0.0;
    for (const amplitude of pcmData) {
      sum += Math.abs(amplitude);
    }

    return sum / pcmData.length;
  };

  peer.on("call", async (call) => {
    call.answer(localStream.clone());

    call.on("stream", (remoteStream) => {
      attachStreamToAudioElement(call.peer, remoteStream);
    });
  });

  document.addEventListener("mousemove", (e) => {
    if (me.x !== e.pageX && me.y !== e.pageY) {
      me.x = e.pageX;
      me.y = e.pageY;

      document.documentElement.style.setProperty(
        "--self-cursor-x",
        `${e.pageX}px`
      );
      document.documentElement.style.setProperty(
        "--self-cursor-y",
        `${e.pageY}px`
      );

      void onDistanceUpdate();
    }
  });

  setInterval(() => {
    me.volume = getVolume();
    document.documentElement.style.setProperty("--self-volume", `${me.volume}`);
  }, 10);

  setInterval(() => {
    if (reqWritable.isWritable()) {
      reqWritable.write(me);
    }
  }, 100);

  window.addEventListener("beforeunload", () => {
    peer.destroy();
    reqWritable.close();
    transport.close();
  });

  // arbitrary tie breaker to determine initiator
  const isInitiator = (other: string) => {
    return other.localeCompare(clientID) < 0;
  };

  const MAX_DISTANCE = 500;
  function powerdropOff(rawDist: number, min: number = 0) {
    const dist = rawDist / MAX_DISTANCE;
    return Math.max(dist > 1 ? 0 : Math.pow(1 - dist, 2), min);
  }

  async function onDistanceUpdate() {
    for (const id in localCursorData) {
      const cursorData = localCursorData[id];
      const { x, y, volume } = cursorData.lastState;

      // euclidean distance between cursor and me to determine call
      const distance = Math.sqrt((x - me.x) ** 2 + (y - me.y) ** 2);

      // scale volume + opacity
      const opacity = powerdropOff(distance, 0);
      const el = document.getElementById(`cursor-${id}`);
      if (el) {
        el.style.opacity = opacity.toString();
        el.style.setProperty("--distance", distance.toString());
        el.style.setProperty("--volume", volume.toString());
      }

      if (distance < MAX_DISTANCE) {
        // call if we are initiator
        if (isInitiator(id) && !cursorData.dialed) {
          cursorData.dialed = true;
          const call = peer.call(id, localStream.clone());
          cursorData.call = call;
          call.on("stream", (remoteStream) => {
            attachStreamToAudioElement(id, remoteStream);
          });
        }

        const apparentVolume = powerdropOff(distance);
        adjustVolume(id, apparentVolume);
      } else if (cursorData.call) {
        // remove call if we are now too far away
        cursorData.call.close();
        cursorData.call = undefined;
        cursorData.dialed = false;
      }
    }
  }

  function attachStreamToAudioElement(id: string, stream: MediaStream) {
    const audioEl = document.getElementById(`audio-${id}`) as HTMLAudioElement;
    if (!audioEl) return;
    audioEl.srcObject = stream;
    audioEl.onloadedmetadata = async () => {
      await audioEl.play();
    };
  }

  function adjustVolume(id: string, volume: number) {
    const audioEl = document.getElementById(`audio-${id}`) as HTMLAudioElement;
    if (!audioEl) return;

    audioEl.volume = volume;
  }

  const cursorContainer = document.getElementById("cursor-container")!;
  for await (const update of resReadable) {
    if (!update.ok) return;

    const id = update.payload.body.id;
    if (id === clientID) continue;

    switch (update.payload.type) {
      case "join":
        const cursorEl = renderCursor(id, "red");
        cursorContainer.appendChild(cursorEl);
        const addPointClosure = ([x, y]: number[]) =>
          cursorEl.style.setProperty("transform", `translate(${x}px, ${y}px)`);
        const perfectCursor = new PerfectCursor(addPointClosure);
        localCursorData[id] = {
          interp: perfectCursor,
          dialed: false,
          lastState: {
            id,
            x: 0,
            y: 0,
            volume: 0,
          },
        };
        break;
      case "update":
        const cursorData = localCursorData[id];
        if (!cursorData) continue;

        const { x, y } = update.payload.body;
        cursorData.interp.addPoint([x, y]);
        cursorData.lastState = update.payload.body;

        void onDistanceUpdate();

        break;
      case "leave":
        const oldCursorEl = cursorContainer.querySelector(`#cursor-${id}`);
        if (!oldCursorEl) continue;

        // if call exists, end it
        const oldCursorData = localCursorData[id];
        if (oldCursorData?.call) {
          oldCursorData.call.close();
          oldCursorData.call = undefined;
        }

        oldCursorEl.remove();
        oldCursorData?.interp.dispose();
        delete localCursorData[id];
        break;
    }
  }
}

void start();
