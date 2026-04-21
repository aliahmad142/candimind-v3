from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import init_db, get_db
from routes import interviews, webhooks
from config import get_settings

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="AI Interview Platform API",
    description="Backend API for AI-powered interview platform using VAPI",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://candimind-v3.vercel.app",  # Production frontend
        "http://localhost:5173",             # Local development
        "http://localhost:3000",             # Alternative local port
        settings.frontend_url                # From environment variable
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(interviews.router)
app.include_router(webhooks.router)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    print("🚀 Starting AI Interview Platform API...")
    init_db()
    print("✅ Database initialized")
    print(f"📡 Backend URL: {settings.backend_url}")
    print(f"🌐 Frontend URL: {settings.frontend_url}")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "AI Interview Platform API",
        "status": "running",
        "version": "1.0.0"
    }


@app.post("/")
async def diagnostic_root(request: Request, db: Session = Depends(get_db)):
    """Diagnostic route to catch and redirect misdirected VAPI webhooks"""
    data = await request.json()
    print(f"📡 DIAGNOSTIC WEBHOOK: {data.get('type')}")
    from routes.webhooks import handle_status_update
    await handle_status_update(data, db)
    return {"status": "success", "message": "LIVE_BACKEND_READY"}


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "vapi": "configured"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
