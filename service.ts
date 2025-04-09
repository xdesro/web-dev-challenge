import { ServiceSchema, Procedure, Ok } from '@replit/river';
import { Static, Type } from '@sinclair/typebox';
import { Observable } from './observable';

type RoomState = {
  cursors: Observable<Static<typeof CursorRoomStateSchema>>
}

const CursorStateSchema = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
})

const CursorRoomStateSchema = Type.Record(Type.String(), CursorStateSchema)

export const RoomService = ServiceSchema.define(
  {
    initializeState: (): RoomState => ({ cursors: new Observable<Static<typeof CursorRoomStateSchema>>({}) }),
  },
  {
    join: Procedure.stream({
      requestInit: Type.Object({}),
      requestData: CursorStateSchema,
      responseData: CursorRoomStateSchema,
      async handler({ ctx, reqReadable, resWritable }) {
        const cursorId = ctx.from
        // server->client update
        const cleanup = ctx.state.cursors.observe(state => {
          resWritable.write(Ok(state))
        })

        ctx.signal.addEventListener('abort', () => {
          cleanup();
        })

        // client->server update
        for await (const req of reqReadable) {
          if (!req.ok) {
            ctx.cancel();
            return;
          }

          ctx.state.cursors.set(state => ({
            ...state,
            [cursorId]: req.payload,
          }))
        }

        return;
      },
    }),
  },
);