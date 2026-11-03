from datetime import datetime

from pydantic import BaseModel, ConfigDict

from volunteers.models import Attendance, MailingMessageStatus, MailingStatus
from volunteers.models.mailing import AssignmentMode
from volunteers.schemas.mailing import MailingButton, MailingDraft, MailingFilter
from volunteers.services.mailing_template import TemplateField, TemplateVariable


class MailingUser(BaseModel):
    user_id: int
    name: str


class MailingCounts(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    pending: int = 0
    sending: int = 0
    sent: int = 0
    failed: int = 0
    unknown: int = 0
    skipped: int = 0
    cancelled: int = 0


class MailingResponse(BaseModel):
    mailing_id: int
    year_id: int
    title: str
    status: MailingStatus
    template: str
    buttons: list[MailingButton]
    filter: MailingFilter
    excluded_form_ids: list[int]
    assignment_mode: AssignmentMode
    created_by: MailingUser | None
    started_by: MailingUser | None
    created_at: datetime
    queued_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    counts: MailingCounts


class MailingListResponse(BaseModel):
    mailings: list[MailingResponse]


class CreateMailingRequest(BaseModel):
    # Copy this mailing instead of creating an empty one
    source_mailing_id: int | None = None


class RecipientAssignment(BaseModel):
    user_day_id: int
    day_id: int
    day_name: str
    # Assignments of the day are published
    day_published: bool
    position_id: int
    position_name: str
    hall_id: int | None
    hall_name: str | None
    attendance: Attendance


class MailingRecipient(BaseModel):
    form_id: int
    user_id: int
    name: str
    telegram_username: str | None
    has_telegram: bool
    excluded: bool
    # Assignments matching the filter
    assignments: list[RecipientAssignment]
    # Assignment of each message the recipient gets, null for a message without one
    message_user_day_ids: list[int | None]


class MailingRecipientsResponse(BaseModel):
    recipients: list[MailingRecipient]
    # The templates use the assignment, so the assignment mode matters
    uses_assignment: bool
    has_unpublished_days: bool
    # Messages to send and to skip (recipients without Telegram), without excluded recipients
    messages: int
    skipped_messages: int


class MailingPreviewRequest(BaseModel):
    draft: MailingDraft
    form_id: int
    user_day_id: int | None = None


class MailingRenderError(BaseModel):
    field: TemplateField
    message: str
    # Index of the button for button fields
    button: int | None
    line: int | None


class MailingPreviewResponse(BaseModel):
    text: str
    buttons: list[MailingButton]
    errors: list[MailingRenderError]


class MailingRecipientError(MailingRenderError):
    form_id: int
    user_day_id: int | None
    recipient_name: str


class StartMailingResponse(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    started: bool
    mailing: MailingResponse
    # Why the mailing can't be started
    description: str | None = None
    errors: list[MailingRecipientError] = []


class ResendMessagesRequest(BaseModel):
    message_ids: list[int]


class MailingMessageResponse(BaseModel):
    message_id: int
    form_id: int | None
    user_day_id: int | None
    user_id: int | None
    recipient_name: str
    telegram_username: str | None
    assignment_label: str | None
    text: str
    buttons: list[MailingButton]
    status: MailingMessageStatus
    error: str | None
    sent_at: datetime | None
    updated_at: datetime


class MailingMessagesResponse(BaseModel):
    messages: list[MailingMessageResponse]


class MailingEvent(BaseModel):
    """Server-sent event: the mailing and its messages changed since the previous event."""

    mailing: MailingResponse
    messages: list[MailingMessageResponse]


class TemplateVariablesResponse(BaseModel):
    variables: list[TemplateVariable]
