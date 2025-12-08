import enum


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    UNSPECIFIED = "unspecified"
