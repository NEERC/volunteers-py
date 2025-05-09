from pydantic import BaseModel


class YearOut(BaseModel):
    year_id: int
    year_name: str
    open_for_registration: bool
