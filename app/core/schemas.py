from pydantic import BaseModel


from pydantic import BaseModel, field_validator

from app.core.status import STATUS_CHOICES


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        value = value.lower()

        if value not in STATUS_CHOICES:
            raise ValueError(
                f"Status must be one of: {', '.join(sorted(STATUS_CHOICES))}"
            )

        return value



class IdNameSchema(BaseModel):
    id: int
    name: str


class SimpleMessage(BaseModel):
    detail: str


class Pagination(BaseModel):
    page: int
    page_size: int