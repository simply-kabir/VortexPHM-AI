from typing import Literal
from pydantic import BaseModel, Field


class DiagnoseIn(BaseModel):
    engine_id: str
    cycle: int


class DecisionIn(BaseModel):
    engine_id: str
    cycle: int
    action: Literal["ACCEPT", "OVERRIDE", "DEFER"]
    engineer_license: str = Field(pattern=r"^[A-Z0-9-]{6,20}$")
    justification: str = Field(min_length=50)


class AddEngineIn(BaseModel):
    uid: str | None = None
    tail_number: str | None = None
    fault_class: str | None = "FAULT_HPT_THERMAL"
