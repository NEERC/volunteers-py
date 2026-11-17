from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from volunteers.models import AssignmentMode
from volunteers.schemas.mailing import MailingFilter

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Source = Annotated[str, StringConstraints(max_length=256_000)]


class CreatePrintTemplate(BaseModel):
    title: Title


class EditPrintTemplate(CreatePrintTemplate):
    source: Source


class PrintTemplateSummary(CreatePrintTemplate):
    model_config = ConfigDict(from_attributes=True)

    template_id: int = Field(validation_alias="id")
    year_id: int


class PrintTemplateList(BaseModel):
    templates: list[PrintTemplateSummary]


class PrintAsset(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: int = Field(validation_alias="id")
    file_name: str
    content_type: str
    size: int


class PrintTemplateDetail(PrintTemplateSummary):
    source: str
    assets: list[PrintAsset]


class PrintContext(BaseModel):
    day_id: int
    filter: MailingFilter = Field(default_factory=MailingFilter)
    assignment_mode: AssignmentMode = AssignmentMode.FIRST
    excluded_form_ids: list[int] = Field(default_factory=list)


class PrintRenderRequest(PrintContext):
    source: Source | None = None


class PrintPreviewRequest(PrintRenderRequest):
    form_id: int | None = None
    user_day_id: int | None = None


class PrintRecipient(BaseModel):
    form_id: int
    user_day_id: int
    name: str


class PrintRecipients(BaseModel):
    recipients: list[PrintRecipient]
