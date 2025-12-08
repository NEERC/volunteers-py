"""WebSocket handlers for assignment updates."""

from typing import Any

import socketio  # type: ignore[import-untyped]
from loguru import logger


async def register_assignment_handlers(sio: socketio.AsyncServer) -> None:
    """Register all assignment-related socket handlers."""

    @sio.event  # type: ignore[misc]
    async def connect(sid: str, environ: dict[str, Any]) -> None:
        """Handle client connection."""
        logger.info(f"Client connected: {sid}")

    @sio.event  # type: ignore[misc]
    async def disconnect(sid: str) -> None:
        """Handle client disconnection."""
        logger.info(f"Client disconnected: {sid}")

    @sio.on("subscribe_day_assignments")  # type: ignore[misc]
    async def handle_subscribe(sid: str, data: dict[str, Any]) -> None:
        """Subscribe to assignment updates for a specific day."""
        day_id = data.get("day_id")
        if not day_id:
            logger.warning(f"Client {sid} tried to subscribe without day_id")
            return

        room = f"day_assignments_{day_id}"
        await sio.enter_room(sid, room)
        logger.info(f"Client {sid} subscribed to {room}")

    @sio.on("unsubscribe_day_assignments")  # type: ignore[misc]
    async def handle_unsubscribe(sid: str, data: dict[str, Any]) -> None:
        """Unsubscribe from assignment updates for a specific day."""
        day_id = data.get("day_id")
        if not day_id:
            logger.warning(f"Client {sid} tried to unsubscribe without day_id")
            return

        room = f"day_assignments_{day_id}"
        await sio.leave_room(sid, room)
        logger.info(f"Client {sid} unsubscribed from {room}")


async def broadcast_assignment_update(
    sio: socketio.AsyncServer,
    day_id: int,
    event_type: str,
    assignment_data: dict[str, Any] | None = None,
) -> None:
    """
    Broadcast assignment update to all clients subscribed to the day.

    Args:
        sio: SocketIO server instance
        day_id: ID of the day whose assignments changed
        event_type: Type of event ('created', 'updated', 'deleted', 'published')
        assignment_data: Optional assignment data to send with the event
    """
    room = f"day_assignments_{day_id}"
    await sio.emit(
        "assignment_updated",
        {"type": event_type, "day_id": day_id, "assignment": assignment_data},
        room=room,
    )
    logger.info(f"Broadcasted {event_type} event to room {room}")
