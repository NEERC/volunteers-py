import { io, type Socket } from "socket.io-client";
import { authStore } from "@/store/auth";

let socketInstance: Socket | null = null;

/**
 * Get or create the singleton Socket.IO client instance.
 * The socket will automatically include authentication token and handle reconnection.
 *
 * @returns The Socket.IO client instance
 */
export function getSocket(): Socket {
  // If socket exists and is connected, return it
  if (socketInstance?.connected) {
    return socketInstance;
  }

  // If socket exists but is disconnected, reconnect it
  if (socketInstance && !socketInstance.connected) {
    socketInstance.connect();
    return socketInstance;
  }

  // Connect to the same origin, the base path (PUBLIC_URL) goes into `path`:
  // the path of a URL passed to io() is the namespace, not a prefix. In
  // development Vite proxies /socket.io to the backend.
  // The default transports (polling, then the upgrade to WebSocket) keep
  // working behind proxies that don't pass WebSocket upgrades.
  // `auth` is a callback so every reconnect picks up the current (possibly
  // refreshed) token.
  socketInstance = io({
    path: `${import.meta.env.BASE_URL}socket.io`,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Number.POSITIVE_INFINITY,
    auth: (cb) => {
      const token = authStore.getAccessToken();
      cb(token ? { token: `Bearer ${token}` } : {});
    },
  });

  // Handle connection errors
  socketInstance.on("connect_error", (error: Error) => {
    console.error("Socket connection error:", error);
  });

  // Handle disconnection
  socketInstance.on("disconnect", (reason: string) => {
    console.log("Socket disconnected:", reason);
  });

  return socketInstance;
}

/**
 * Disconnect and cleanup the socket instance.
 * Useful for cleanup or when logging out.
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
