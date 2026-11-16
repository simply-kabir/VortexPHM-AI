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
