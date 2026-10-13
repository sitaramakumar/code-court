import { randomBytes, randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { action, advanceExpired, createRoom, makeSnapshot, validateCreate } from "../../lib/game-core.js";

type RoomStore = ReturnType<typeof getStore>;
type StoreProvider = () => RoomStore;
type ApiResult = { status: number; data: Record<string, unknown>; changed: boolean };

const STORE_NAME = "code-court-rooms";
const MAX_RETRIES = 12;
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function response(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function transact(store: RoomStore, code: string, mutate: (room: any, now: number) => ApiResult): Promise<ApiResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const current = await store.getWithMetadata(code, { type: "json", consistency: "strong" }) as { data: any; etag: string } | null;
    if (!current?.data) return { status: 404, data: { error: "That room code was not found." }, changed: false };
    const room = current.data;
    const now = Date.now();
    const timerChanged = advanceExpired(room, now);
    const result = mutate(room, now);
    if (!timerChanged && !result.changed) return result;
    room.lastActivityAt = now;
    const write = await store.setJSON(code, room, { onlyIfMatch: current.etag });
    if (write.modified) return result;
  }
  return { status: 409, data: { error: "The room is busy. Please try again." }, changed: false };
}

export function createGameHandler(storeProvider: StoreProvider = () => getStore({ name: STORE_NAME, consistency: "strong" })) {
  return async (request: Request): Promise<Response> => {
    try {
      const store = storeProvider();
      const url = new URL(request.url);

      if (request.method === "GET") {
        if (url.searchParams.get("action") !== "state") return response(404, { error: "Unknown action." });
        const code = (url.searchParams.get("code") || "").trim().toUpperCase();
        const playerId = url.searchParams.get("playerId") || "";
        if (!/^[A-F0-9]{6}$/.test(code) || !playerId) return response(400, { error: "A room code and player seat are required." });
        const result = await transact(store, code, (room, now) => {
          const player = room.players[playerId];
          if (!player) return { status: 403, data: { error: "That seat is no longer in the room." }, changed: false };
          const shouldRefreshPresence = now - player.lastSeenAt >= 8_000;
          if (shouldRefreshPresence) player.lastSeenAt = now;
          return { status: 200, data: makeSnapshot(room, playerId, now), changed: shouldRefreshPresence };
        });
        return response(result.status, result.data);
      }

      if (request.method !== "POST") return response(405, { error: "Use GET or POST for this endpoint." });
      const body = await request.json().catch(() => null) as Record<string, any> | null;
      if (!body || typeof body !== "object") return response(400, { error: "Could not read that request." });
      const actionName = String(body.action || "");
      if (actionName === "create") {
        const validated = validateCreate(body);
        if ("error" in validated) return response(400, validated);
        const playerId = String(body.playerId || randomUUID());
        for (let attempt = 0; attempt < 12; attempt++) {
          const code = randomBytes(3).toString("hex").toUpperCase();
          const { room } = createRoom({ code, name: validated.name, playerId, mode: body.mode, countdown: validated.countdown });
          const write = await store.setJSON(code, room, { onlyIfNew: true });
          if (write.modified) return response(201, { code, playerId });
        }
        return response(503, { error: "Could not reserve a room code. Please try again." });
      }

      const code = String(body.code || "").trim().toUpperCase();
      if (!/^[A-F0-9]{6}$/.test(code)) return response(400, { error: "Enter a valid six-character room code." });
      const receivedAt = Date.now();
      const result = await transact(store, code, (room, now) => {
        if (actionName === "state") {
          const player = room.players[String(body.playerId || "")];
          if (!player) return { status: 403, data: { error: "That seat is no longer in the room." }, changed: false };
          const shouldRefreshPresence = now - player.lastSeenAt >= 8_000;
          if (shouldRefreshPresence) player.lastSeenAt = now;
          return { status: 200, data: makeSnapshot(room, player.id, now), changed: shouldRefreshPresence };
        }
        const outcome = action(room, actionName, { ...body, receivedAt }, now);
        return { status: outcome.status, data: outcome.data, changed: outcome.changed };
      });
      return response(result.status, result.data);
    } catch (error) {
      console.error("Code Court function error", error);
      return response(500, { error: "The courtroom could not save that update. Please retry." });
    }
  };
}

export default createGameHandler();
