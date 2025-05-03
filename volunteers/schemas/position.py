from pydantic import BaseModel


class PositionIn(BaseModel):
    position_id: int
    name: str


class PositionOut(PositionIn):
    pass
