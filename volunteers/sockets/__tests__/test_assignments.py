from unittest.mock import AsyncMock

import socketio  # type: ignore[import-untyped]

from volunteers.sockets.assignments import register_assignment_handlers


async def test_connect_accepts_auth() -> None:
    sio = socketio.AsyncServer(async_mode="asgi")
    await register_assignment_handlers(sio)

    # The UI always connects with `auth: { token }`, python-socketio then
    # calls the handler with a third argument.
    ret = await sio._trigger_event("connect", "/", "sid", {}, {"token": "Bearer x"})
    assert ret is None
    ret = await sio._trigger_event("connect", "/", "sid", {})
    assert ret is None


async def test_subscribe_enters_day_room() -> None:
    sio = socketio.AsyncServer(async_mode="asgi")
    sio.enter_room = AsyncMock()
    sio.leave_room = AsyncMock()
    await register_assignment_handlers(sio)

    await sio._trigger_event("subscribe_day_assignments", "/", "sid", {"day_id": 5})
    sio.enter_room.assert_awaited_once_with("sid", "day_assignments_5")

    await sio._trigger_event("unsubscribe_day_assignments", "/", "sid", {"day_id": 5})
    sio.leave_room.assert_awaited_once_with("sid", "day_assignments_5")
