from typing import Literal, TypeVar

from pydantic import BaseModel, ConfigDict


class Base(BaseModel):
    pass


SuccessT = TypeVar("SuccessT", bound=Literal[True])


class BaseResponse[SuccessT](Base):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)
    success: SuccessT


class BaseSuccessResponse(BaseResponse[Literal[True]]):
    success: Literal[True] = True


class BaseErrorResponse(BaseResponse[Literal[False]]):
    success: Literal[False] = False
    description: str
