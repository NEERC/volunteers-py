from typing import Literal

from pydantic import BaseModel


class Base(BaseModel):
    pass

class BaseResponse(Base):
    pass

class BaseSuccessResponse(BaseResponse):
    success: Literal[True] = True

class BaseErrorResponse(BaseResponse):
    success: Literal[False] = False
    description: str
