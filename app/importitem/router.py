from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    UploadFile,
)

from sqlalchemy.orm import Session

from app.database import get_db
from app.users.schemas import UserDisplaySchema
from app.users.permissions import role_required

from app.core.roles import USER_MANAGEMENT_ROLES

from app.importitem import service


router = APIRouter()


# ==========================================================
# IMPORT STORE ITEMS FROM EXCEL
# ==========================================================

@router.post("/import-excel")
def import_from_excel(
    file: UploadFile = File(...),

    # ------------------------------------------------------
    # Required for Super Admin.
    # Ignored for normal business users.
    # ------------------------------------------------------
    business_id: int | None = Form(None),

    db: Session = Depends(get_db),

    current_user: UserDisplaySchema = Depends(
        role_required(USER_MANAGEMENT_ROLES)
    ),
):
    return service.import_from_excel(
        db=db,
        file=file,
        current_user=current_user,
        business_id=business_id,
    )