"""Templates of mailing messages: Jinja2 in a sandbox, rendered to Telegram HTML."""

import types
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any, Literal, Union, get_args, get_origin
from urllib.parse import urlparse

from jinja2 import StrictUndefined, TemplateSyntaxError, meta
from jinja2.sandbox import ImmutableSandboxedEnvironment
from pydantic import BaseModel, ConfigDict, Field

# Limit of the message text after parsing the markup, in UTF-16 code units
MAX_TEXT_LENGTH = 4096

# Variables that exist only when the mailing has an assignment filter
ASSIGNMENT_VARIABLES = frozenset({"assignment", "day", "position", "hall"})


class UserContext(BaseModel):
    first_name_ru: str = Field(description="First name (Russian)")
    last_name_ru: str = Field(description="Last name (Russian)")
    patronymic_ru: str | None = Field(description="Patronymic (Russian)")
    first_name_en: str = Field(description="First name (English)")
    last_name_en: str = Field(description="Last name (English)")
    telegram_username: str | None = Field(description="Telegram username")
    phone: str | None = Field(description="Phone")
    email: str | None = Field(description="Email")


class FormContext(BaseModel):
    itmo_group: str | None = Field(description="ITMO group")
    needs_invitation: bool = Field(description="Needs an invitation")


class YearContext(BaseModel):
    year_name: str = Field(description="Year name")


class DayContext(BaseModel):
    id: int = Field(description="Day ID")
    name: str = Field(description="Day name")
    information: str = Field(description="Day information")


class PositionContext(BaseModel):
    id: int = Field(description="Position ID")
    name: str = Field(description="Position name")
    description: str | None = Field(description="Position description")


class HallContext(BaseModel):
    id: int = Field(description="Hall ID")
    name: str = Field(description="Hall name")
    description: str | None = Field(description="Hall description")


class AssignmentContext(BaseModel):
    day: DayContext = Field(description="Day")
    position: PositionContext = Field(description="Position")
    hall: HallContext | None = Field(description="Hall, empty when not assigned to a hall")
    attendance: str = Field(description="Attendance: yes, no, late, sick or unknown")
    information: str = Field(description="Assignment information")


class TemplateContext(BaseModel):
    user: UserContext = Field(description="Recipient")
    form: FormContext = Field(description="Application form")
    year: YearContext = Field(description="Year")
    # Only with an assignment filter
    assignment: AssignmentContext | None = Field(
        description="Matched assignment (only with an assignment filter)"
    )
    day: DayContext | None = Field(description="Day of the assignment")
    position: PositionContext | None = Field(description="Position of the assignment")
    hall: HallContext | None = Field(
        description="Hall of the assignment, empty when not assigned to a hall"
    )

    def variables(self) -> dict[str, Any]:
        """Variables of the template: the assignment ones are absent without an assignment."""
        variables: dict[str, Any] = {"user": self.user, "form": self.form, "year": self.year}
        if self.assignment is not None:
            variables.update(
                assignment=self.assignment,
                day=self.assignment.day,
                position=self.assignment.position,
                hall=self.assignment.hall,
            )
        return variables


class TemplateVariable(BaseModel):
    """A variable of the template context, for autocompletion in the editor."""

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    name: str
    type: str
    nullable: bool
    # In English, translated by the UI
    description: str
    # Only with an assignment filter
    assignment_only: bool = False
    fields: list["TemplateVariable"] = []


def _variables(model: type[BaseModel], top_level: bool = False) -> list[TemplateVariable]:
    variables = []
    for name, info in model.model_fields.items():
        annotation = info.annotation
        nullable = False
        if get_origin(annotation) in (Union, types.UnionType):
            args = [arg for arg in get_args(annotation) if arg is not type(None)]
            nullable = len(args) != len(get_args(annotation))
            annotation = args[0]
        field_model = (
            annotation
            if isinstance(annotation, type) and issubclass(annotation, BaseModel)
            else None
        )
        variables.append(
            TemplateVariable(
                name=name,
                type="object" if field_model else getattr(annotation, "__name__", str(annotation)),
                # Assignment variables are always set when they exist, except for the hall
                nullable=nullable and not (top_level and name in ASSIGNMENT_VARIABLES - {"hall"}),
                description=info.description or "",
                assignment_only=top_level and name in ASSIGNMENT_VARIABLES,
                fields=_variables(field_model) if field_model else [],
            )
        )
    return variables


def template_variables() -> list[TemplateVariable]:
    return _variables(TemplateContext, top_level=True)


_html_env = ImmutableSandboxedEnvironment(autoescape=True, undefined=StrictUndefined)
# Buttons are not HTML: their text and URL go to the keyboard as is
_plain_env = ImmutableSandboxedEnvironment(autoescape=False, undefined=StrictUndefined)


TemplateField = Literal["text", "button_text", "button_url"]


@dataclass
class RenderError:
    field: TemplateField
    message: str
    # Index of the button for button fields
    button: int | None = None
    line: int | None = None


@dataclass
class RenderedButton:
    text: str
    url: str


@dataclass
class RenderedMessage:
    text: str
    buttons: list[RenderedButton] = field(default_factory=list)
    errors: list[RenderError] = field(default_factory=list)


def uses_assignment(template: str, buttons: list[dict[str, str]]) -> bool:
    """Whether the templates refer to the assignment variables (templates with errors don't)."""
    sources = [template] + [b.get(key, "") for b in buttons for key in ("text", "url")]
    for source in sources:
        try:
            variables = meta.find_undeclared_variables(_html_env.parse(source))
        except TemplateSyntaxError:
            continue
        if variables & ASSIGNMENT_VARIABLES:
            return True
    return False


def _render(
    env: ImmutableSandboxedEnvironment,
    source: str,
    variables: dict[str, Any],
    error_field: TemplateField,
    button: int | None,
    errors: list[RenderError],
) -> str:
    try:
        return env.from_string(source).render(variables)
    except TemplateSyntaxError as e:
        errors.append(RenderError(error_field, e.message or str(e), button, e.lineno))
    except Exception as e:
        errors.append(RenderError(error_field, str(e) or e.__class__.__name__, button))
    return ""


def render_message(
    template: str, buttons: list[dict[str, str]], context: TemplateContext
) -> RenderedMessage:
    """Render the message for a recipient and validate it against the limits of Telegram."""
    variables = context.variables()
    errors: list[RenderError] = []

    text = _render(_html_env, template, variables, "text", None, errors)
    if not errors:
        errors.extend(RenderError("text", message) for message in validate_html(text))

    rendered_buttons = []
    for i, button in enumerate(buttons):
        button_text = _render(
            _plain_env, button.get("text", ""), variables, "button_text", i, errors
        ).strip()
        url = _render(_plain_env, button.get("url", ""), variables, "button_url", i, errors).strip()
        if not button_text:
            errors.append(RenderError("button_text", "Button text is empty", i))
        if not _is_valid_url(url):
            errors.append(RenderError("button_url", f"Invalid URL: {url!r}", i))
        rendered_buttons.append(RenderedButton(button_text, url))

    return RenderedMessage(text, rendered_buttons, errors)


def _is_valid_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme in ("http", "https"):
        return bool(parsed.netloc)
    return parsed.scheme == "tg" and bool(parsed.netloc or parsed.path)


# Tags of Telegram HTML and their allowed attributes, see https://core.telegram.org/bots/api#html-style
_TAGS: dict[str, set[str]] = {
    "b": set(),
    "strong": set(),
    "i": set(),
    "em": set(),
    "u": set(),
    "ins": set(),
    "s": set(),
    "strike": set(),
    "del": set(),
    "tg-spoiler": set(),
    "span": {"class"},
    "a": {"href"},
    "tg-emoji": {"emoji-id"},
    "code": {"class"},
    "pre": set(),
    "blockquote": {"expandable"},
}
_ENTITIES = {"lt": "<", "gt": ">", "amp": "&", "quot": '"'}


class _TelegramHTMLValidator(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.errors: list[str] = []
        self.stack: list[str] = []
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in _TAGS:
            self.errors.append(f"Unsupported tag <{tag}>")
            return
        for name, value in attrs:
            if name not in _TAGS[tag]:
                self.errors.append(f"Unsupported attribute {name!r} of <{tag}>")
            elif tag == "span" and value != "tg-spoiler":
                self.errors.append('<span> is only supported with class="tg-spoiler"')
        names = {name for name, _ in attrs}
        if tag == "a" and "href" not in names:
            self.errors.append("<a> without href")
        if tag == "tg-emoji" and "emoji-id" not in names:
            self.errors.append("<tg-emoji> without emoji-id")
        if tag == "span" and "class" not in names:
            self.errors.append('<span> is only supported with class="tg-spoiler"')
        self.stack.append(tag)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.errors.append(f"Self-closing tag <{tag}/> is not supported")

    def handle_endtag(self, tag: str) -> None:
        if tag not in _TAGS:
            self.errors.append(f"Unsupported tag </{tag}>")
        elif not self.stack or self.stack[-1] != tag:
            self.errors.append(f"Unexpected closing tag </{tag}>")
        else:
            self.stack.pop()

    def handle_data(self, data: str) -> None:
        for char in "<>&":
            if char in data:
                self.errors.append(f"Unescaped {char!r}, write it as an HTML entity")
        self.text.append(data)

    def handle_entityref(self, name: str) -> None:
        if name not in _ENTITIES:
            self.errors.append(f"Unsupported HTML entity &{name};")
        self.text.append(_ENTITIES.get(name, "?"))

    def handle_charref(self, name: str) -> None:
        self.text.append("?")

    def handle_comment(self, data: str) -> None:
        self.errors.append("HTML comments are not supported")

    def handle_decl(self, decl: str) -> None:
        self.errors.append("HTML declarations are not supported")

    def unknown_decl(self, data: str) -> None:
        self.errors.append("HTML declarations are not supported")


def validate_html(text: str) -> list[str]:
    """Problems of the Telegram HTML message, empty if Telegram will accept it."""
    parser = _TelegramHTMLValidator()
    parser.feed(text)
    parser.close()
    errors = parser.errors
    # Leftover of an incomplete tag, e.g. "a < b" at the end
    if parser.rawdata:
        errors.append("Unescaped '<', write it as an HTML entity")
    errors.extend(f"Unclosed tag <{tag}>" for tag in parser.stack)

    plain = "".join(parser.text)
    if not plain.strip():
        errors.append("Message text is empty")
    length = len(plain.encode("utf-16-le")) // 2
    if length > MAX_TEXT_LENGTH:
        errors.append(f"Message is too long: {length} characters, at most {MAX_TEXT_LENGTH}")
    # Same error reported for every occurrence is noise
    return list(dict.fromkeys(errors))
