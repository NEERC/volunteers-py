from pydantic import BaseModel


class ApplicationFormExtraFields(BaseModel):
    """Typed view over the `extra_fields` JSONB column of an application form."""

    itmo_group: str | None = None
    comments: str = ""
    additional_skills: str = ""
    needs_invitation: bool = False
    lives_in_vyazma: bool = False


class ApplicationFormIn(BaseModel):
    year_id: int
    user_id: int
    desired_positions_ids: set[int]
    itmo_group: str | None
    comments: str = ""
    additional_skills: str = ""
    needs_invitation: bool = False
    lives_in_vyazma: bool = False
