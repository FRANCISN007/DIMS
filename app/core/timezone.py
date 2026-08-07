from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# ==========================================================
# Application Time Zone
# ==========================================================

WAT = ZoneInfo("Africa/Lagos")


# ==========================================================
# Current Time
# ==========================================================

def now_wat() -> datetime:
    """
    Return the current application time (Africa/Lagos).
    """
    return datetime.now(WAT)


# ==========================================================
# Convert Any Datetime to WAT
# ==========================================================

def to_wat(dt: datetime) -> datetime:
    """
    Convert a naive or timezone-aware datetime to Africa/Lagos.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(WAT)