import { Static, Type } from "@sinclair/typebox";

export const CursorStateSchema = Type.Object({
  id: Type.String(),
  x: Type.Number(),
  y: Type.Number(),
  volume: Type.Number(),
});

const CursorJoinSchema = Type.Object({
  type: Type.Literal("join"),
  body: Type.Object({ id: Type.String() }),
});

const CursorUpdateSchema = Type.Object({
  type: Type.Literal("update"),
  body: CursorStateSchema,
});

const CursorLeaveSchema = Type.Object({
  type: Type.Literal("leave"),
  body: Type.Object({ id: Type.String() }),
});

export const UpdateSchema = Type.Union([
  CursorJoinSchema,
  CursorLeaveSchema,
  CursorUpdateSchema,
]);
export type Update = Static<typeof UpdateSchema>;

export class ListenerList {
  private listeners: Set<(update: Update) => void> = new Set();

  addListener(listener: (update: Update) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(update: Update): void {
    for (const listener of this.listeners) {
      listener(update);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export type CursorState = Static<typeof CursorStateSchema>;
