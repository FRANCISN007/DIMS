from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from jose import jwt, JWTError
from sqlalchemy.orm import Session
import os

from app.core.tenant import set_current_business
from app.database import SessionLocal
from app.users import crud

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")


class TenantMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):

        db: Session = SessionLocal()

        try:

            business_id = None

            auth_header = request.headers.get("Authorization")

            if auth_header and auth_header.startswith("Bearer "):

                token = auth_header.split(" ", 1)[1]

                try:

                    payload = jwt.decode(
                        token,
                        SECRET_KEY,
                        algorithms=[ALGORITHM],
                    )

                    username = payload.get("sub")

                    if username:

                        user = crud.get_user_by_username(
                            db,
                            username,
                        )

                        if user:

                            # =====================================
                            # SUPER ADMIN
                            # =====================================
                            if user.business_id is None:

                                header_business = request.headers.get(
                                    "X-Business-Id"
                                )

                                query_business = request.query_params.get(
                                    "business_id"
                                )

                                selected_business = (
                                    header_business or query_business
                                )

                                if selected_business:

                                    try:
                                        business_id = int(selected_business)
                                    except ValueError:
                                        business_id = "INVALID"

                                else:
                                    business_id = "REQUIRED"

                            # =====================================
                            # NORMAL BUSINESS USER
                            # =====================================
                            else:

                                business_id = user.business_id

                except JWTError:
                    business_id = None

            # -------------------------------------
            # Set tenant context
            # -------------------------------------
            set_current_business(business_id)

            response = await call_next(request)

            return response

        finally:

            set_current_business(None)

            db.close()