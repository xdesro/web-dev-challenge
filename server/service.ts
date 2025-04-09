import { ServiceSchema, Procedure, Ok } from '@replit/river';
import { Type } from '@sinclair/typebox';
import { ListenerList, CursorState, UpdateSchema, CursorStateSchema } from './listener';

type RoomState = {
  cursors: Record<string, CursorState>;
  listeners: ListenerList;
}

export const RoomService = ServiceSchema.define(
  {
    initializeState: (): RoomState => ({ 
      cursors: {},
      listeners: new ListenerList(),
    }),
  },
  {
    join: Procedure.stream({
      requestInit: Type.Object({}),
      requestData: Type.Omit(CursorStateSchema, ['id']),
      responseData: UpdateSchema,
      async handler({ ctx, reqReadable, resWritable }) {
        const cursorId = ctx.from

        // Add listener for this client to receive updates
        const cleanup = ctx.state.listeners.addListener((update) => {
          resWritable.write(Ok(update));
        });

        // notify all listeners about the new cursor
        ctx.state.listeners.notify({
          type: 'join',
          body: { id: cursorId },
        });

        // notify this client of all existing cursors
        for (const cursorId in ctx.state.cursors) {
          ctx.state.listeners.notify({
            type: 'join',
            body: { id: cursorId },
          });
        }

        ctx.signal.addEventListener('abort', () => {
          cleanup();

          // Remove cursor and notify others
          delete ctx.state.cursors[cursorId];          
          ctx.state.listeners.notify({
            type: 'leave',
            body: { id: cursorId },
          });
        });

        // Handle incoming cursor updates from this client
        for await (const req of reqReadable) {
          if (!req.ok) {
            ctx.cancel();
            return;
          }

          // Update cursor position
          ctx.state.cursors[cursorId] = {
            ...req.payload,
            id: cursorId,
          };

          // Notify all listeners about the cursor update
          ctx.state.listeners.notify({
            type: 'update',
            body: ctx.state.cursors[cursorId],
          });
        }
      },
    }),
  },
);