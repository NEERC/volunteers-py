from pydantic import BaseModel


class ApplicationFormIn(BaseModel):
    year_id: int
    user_id: int
    desired_positions_ids: set[int]
    itmo_group: str | None
    comments: str = ""
    needs_invitation: bool = False
