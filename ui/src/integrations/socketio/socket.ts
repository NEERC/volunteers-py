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

  // Determine the socket URL
  // In development, Vite proxies /socket.io to localhost:8000
  // In production, use the same base URL as the API
  const baseURL = import.meta.env.BASE_URL || "";
  const socketURL = import.meta.env.DEV
    ? "" // Use relative path in dev (Vite proxy handles it)
    : baseURL.replace(/\/$/, ""); // Remove trailing slash if present

  // Get current auth token
  const token = authStore.getAccessToken(); // prone to errors. TODO: fix this.

  // Create socket instance with authentication
  socketInstance = io(socketURL, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Number.POSITIVE_INFINITY,
    auth: token
      ? {
          token: `Bearer ${token}`,
        }
      : undefined,
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
