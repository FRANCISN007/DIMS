import os
import sys
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles





# Routers
from app.users.routers import router as user_router
from app.roles.router import router as role_router
from app.locations.router import router as location_router

from app.catering.router import router as catering_router



from app.license.router import router as license_router

from backup.backup import router as backup_router

from app.importitem.router import router as importitem_router


from app.store.router import router as store_router

from app.vendor.router import router as vendor_router

from app.superadmin.router import router as superadmin_router
from app.business.router import router as business_router


import pytz
from datetime import datetime
from contextlib import asynccontextmanager

from app.core.tenant_middleware import TenantMiddleware




# --------------------------------------------------
# ENV LOADING (works for installer / frozen mode)
# --------------------------------------------------
POSSIBLE_ENV_PATHS = [
    Path(__file__).resolve().parent.parent / ".env",
    Path(sys.executable).resolve().parent / ".env",
    Path.cwd() / ".env",
]

for env_path in POSSIBLE_ENV_PATHS:
    if env_path.exists():
        load_dotenv(env_path, override=True)
        print(f"[INFO] Loaded .env from {env_path}")
        break

from app.database import engine, Base


SERVER_IP = os.getenv("SERVER_IP", "127.0.0.1")
print(f"[INFO] SERVER_IP = {SERVER_IP}")

# --------------------------------------------------
# TIMEZONE
# --------------------------------------------------
os.environ["TZ"] = "Africa/Lagos"
lagos_tz = pytz.timezone("Africa/Lagos")
print("[INFO] Time:", datetime.now(lagos_tz))

# --------------------------------------------------
# PATH FIX
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# --------------------------------------------------
# DATABASE LIFESPAN
# --------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[INFO] Application starting...")
    Base.metadata.create_all(bind=engine)
    yield
    print("[INFO] Application shutting down...")

# --------------------------------------------------
# FASTAPI APP
# --------------------------------------------------
app = FastAPI(
    title="Distribution & Inventory Management System",
    version="1.0.0",
    lifespan=lifespan
)



# --------------------------------------------------
# CORS (LAN SAFE)
# --------------------------------------------------
origins = [
    "https://hemshotel.com",
    "https://www.hemshotel.com",
    "https://hems-frontend-production.up.railway.app",
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TenantMiddleware)

# --------------------------------------------------
# FILE UPLOADS
# --------------------------------------------------
os.makedirs("uploads/attachments", exist_ok=True)
app.mount("/files", StaticFiles(directory="uploads"), name="files")

# --------------------------------------------------
# API ROUTERS (IMPORTANT: BEFORE SPA)
# --------------------------------------------------
app.include_router(superadmin_router, prefix="/superadmin", tags=["Super Admin"])
app.include_router(business_router, prefix="/business", tags=["Business"])
app.include_router(user_router, prefix="/users", tags=["Users"])
app.include_router(role_router, prefix="/roles", tags=["Roles"])
app.include_router(location_router, prefix="/locations", tags=["Location"])

app.include_router(catering_router, prefix="/catering", tags=["Catering Services"])





app.include_router(license_router, prefix="/license", tags=["License"])
app.include_router(store_router, prefix="/store", tags=["Store"])
#app.include_router(bar_router, prefix="/bar", tags=["Bar"])
#app.include_router(barpayment_router, prefix="/barpayment", tags=["Bar Payments"])
app.include_router(vendor_router, prefix="/vendor", tags=["Vendor"])


app.include_router(backup_router)
app.include_router(importitem_router, prefix="/importitem", tags=["Import Items"])

# --------------------------------------------------
# HEALTH
# --------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug/ping")
def ping():
    return {"status": "ok"}

# --------------------------------------------------
# REACT FRONTEND
# --------------------------------------------------
REACT_BUILD_DIR = BASE_DIR / "react-frontend" / "build"
REACT_STATIC_DIR = REACT_BUILD_DIR / "static"
INDEX_FILE = REACT_BUILD_DIR / "index.html"




# 👇 Add this here
print("Build directory:", REACT_BUILD_DIR)

if REACT_BUILD_DIR.exists():
    print("Build directory contents:")
    for f in REACT_BUILD_DIR.iterdir():
        print(" -", f.name)

    # Serve React static assets
    app.mount("/static", StaticFiles(directory=REACT_STATIC_DIR), name="static")

    # Serve images
    app.mount("/images", StaticFiles(directory=REACT_BUILD_DIR / "images"), name="images")

    print(f"[INFO] React build detected: {REACT_BUILD_DIR}")
    print(f"[INFO] React build detected: {REACT_BUILD_DIR}")
else:
    print("[WARNING] React build not found")



# --------------------------------------------------
# SEO FILES
# --------------------------------------------------

@app.get("/googleb9019794261073a2.html", include_in_schema=False)
def google_verification():
    print("***** GOOGLE VERIFICATION ROUTE CALLED *****")
    return FileResponse(REACT_BUILD_DIR / "googleb9019794261073a2.html")



@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(REACT_BUILD_DIR / "favicon.ico")


@app.get("/manifest.json", include_in_schema=False)
def manifest():
    return FileResponse(REACT_BUILD_DIR / "manifest.json")


@app.get("/robots.txt", include_in_schema=False)
def robots():
    return FileResponse(REACT_BUILD_DIR / "robots.txt")


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap():
    return FileResponse(REACT_BUILD_DIR / "sitemap.xml")


@app.get("/googleb9019794261073a2.html", include_in_schema=False)
def google_verification():
    file = REACT_BUILD_DIR / "googleb9019794261073a2.html"
    print("Google verification file:", file)
    print("Exists:", file.exists())
    return FileResponse(file)





# --------------------------------------------------
# SPA FALLBACK (CRITICAL FIX)
# --------------------------------------------------
@app.middleware("http")
async def spa_fallback(request: Request, call_next):
    response = await call_next(request)

    # If API route → return JSON normally
    if request.url.path.startswith((
        "/users",
        "/superadmin",
        "/business",
        "/rooms",
        "/bookings",
        "/payments",
        "/events",
        "/eventpayment",
        "/license",
        "/store",
        "/bar",
        "/roles",
        "/locations",
        "/catering",
        "/vendor",
        "/kitchen",
        "/restaurant",
        "/restpayment",
        "/bank",
        "/backup",
        "/files",
        "/static",
        "/images",
        "/favicon.ico",
        "/manifest.json",
        "/robots.txt",
        "/sitemap.xml",
        "/googleb9019794261073a2.html",
        "/health",
        "/debug"
    )):
        return response

    # If frontend route and 404 → serve React
    if response.status_code == 404 and INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)

    return response
