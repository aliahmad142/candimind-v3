from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
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
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
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
