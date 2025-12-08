"""SocketIO configuration and initialization."""

import socketio  # type: ignore[import-untyped]

# Create Socket.IO server with ASGI support
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",  # In production, specify exact origins
    logger=True,
    engineio_logger=True,
)

# Create ASGI application
# Socket.IO will be available at /socket.io/
socket_app = socketio.ASGIApp(sio)
