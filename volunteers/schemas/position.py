from pydantic import BaseModel


class PositionIn(BaseModel):
    position_id: int


class PositionOut(PositionIn):
    name: str
