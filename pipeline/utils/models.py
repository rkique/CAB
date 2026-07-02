"""Pydantic models for CAB course records and embedding text construction."""

from __future__ import annotations

import hashlib
import re
from typing import Any

from pydantic import BaseModel, Field


class CourseRating(BaseModel):
    response_rate: str = ""
    score: str = ""

#fully documented CAB + CR record, not necessary to embed all details.
class CourseRecord(BaseModel):
    key: str = ""
    code: str = ""
    title: str = ""
    crn: str = ""
    srcdb: str = ""
    no: str = ""
    description: str = ""
    instr: str = ""
    programs: list[str] = Field(default_factory=list)

    meets: str = "TBA"
    meetingTimes: str = "[]"
    start_date: str = ""
    end_date: str = ""
    schd: str = ""

    # Enrollment fields
    total: str = ""
    stat: str = ""
    permreq: str = "N"
    rpt: str = "N"

    # Extended CAB fields
    cab_description: str = ""
    cab_schedule: str = ""
    cab_instructors: list[dict[str, Any]] = Field(default_factory=list)
    professor_and_term: str = ""

    # Critical Review
    average_hours: float | None = None
    max_hours: float | None = None
    course_rating: CourseRating | dict[str, Any] | None = None
    professor_rating: CourseRating | dict[str, Any] | None = None
    cr_edition: str | None = None
    cr_professor: str | None = None
    cr_course_avg: float | None = None
    cr_prof_avg: float | None = None
    cr_avg_hours: float | None = None
    cr_max_hours: float | None = None
    cr_class_size: int | None = None
    cr_num_respondents: int | None = None
    cr_attendance: dict[str, Any] | None = None
    cr_grades: dict[str, Any] | None = None
    cr_requirement: dict[str, Any] | None = None
    cr_concs: int | None = None
    cr_nonconcs: int | None = None
    cr_frosh: int | None = None
    cr_soph: int | None = None
    cr_jun: int | None = None
    cr_sen: int | None = None
    cr_grad: int | None = None

    model_config = {"extra": "allow"}

    def embedding_text(self) -> str:
        """Build the text sent to the embedding model.
        Schema: "{code}: {title}. Instructor: {instr}. Programs: {p1}, {p2}. {description}"
        Fields are only included when present. Must match embed_courses.js/buildEmbeddingText().
        """
        parts: list[str] = []
        if self.code:
            parts.append(f"{self.code}:")
        parts.append(f"{self.title}.")
        if self.instr:
            parts.append(f"Instructor: {self.instr}.")
        if self.programs:
            parts.append(f"Programs: {', '.join(self.programs)}.")
        parts.append(self.description)
        return re.sub(r"\s+", " ", " ".join(parts)).strip()

    def embedding_key(self, fallback_srcdb: str = "") -> str:
        return f"{self.crn}:{self.srcdb or fallback_srcdb}"

    def text_hash(self) -> str:
        text = self.embedding_text()
        digest = hashlib.sha256(text.encode()).hexdigest()
        return f"sha256:{digest}"
