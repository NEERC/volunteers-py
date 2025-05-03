from pydantic import BaseModel

from .position import PositionIn


class ApplicationFormIn(BaseModel):
    year_id: int
    user_id: int
    desired_positions: set[PositionIn]
    itmo_group: str | None
    comments: str = ""
