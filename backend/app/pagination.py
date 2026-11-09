"""Offset pagination returning a {items, total, page, page_size, pages} envelope."""

from __future__ import annotations

import math

from sqlalchemy import Select, func

from .extensions import db


def paginate(stmt: Select, page: int, page_size: int) -> dict:
    total = db.session.scalar(db.select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = db.session.scalars(stmt.limit(page_size).offset((page - 1) * page_size)).all()
    return {
        "items": items,
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil((total or 0) / page_size)),
    }
