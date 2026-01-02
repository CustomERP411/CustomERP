"""
CustomERP AI Gateway
FastAPI service for AI-powered SDF generation using Google Gemini

Endpoints:
    GET  /health     - Health check with AI connection status
    GET  /           - API info and available endpoints
    POST /ai/test    - Test AI generation (development only)
    
Future endpoints (Task D3):
    POST /ai/analyze  - Analyze business description
    POST /ai/clarify  - Process clarification answers
    POST /ai/finalize - Generate final SDF
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import os

from .config import settings
from .services.gemini_client import GeminiClient
from .services.sdf_service import SDFService
from .schemas.sdf import SystemDefinitionFile

# Initialize FastAPI app
app = FastAPI(
    title="CustomERP AI Gateway",
    description="AI-powered requirement analysis and SDF generation using Google Gemini",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-loaded Gemini client (initialized on first use)
_gemini_client: Optional[GeminiClient] = None
_sdf_service: Optional[SDFService] = None


def get_gemini_client():
    """Get or create the Gemini client singleton"""
    global _gemini_client
    if _gemini_client is None:
        if not settings.GOOGLE_AI_API_KEY:
            return None
        from .services.gemini_client import GeminiClient
        _gemini_client = GeminiClient()
    return _gemini_client


def get_sdf_service() -> Optional[SDFService]:
    """Get or create the SDF service singleton"""
    global _sdf_service
    if _sdf_service is None:
        client = get_gemini_client()
        if not client:
            return None
        _sdf_service = SDFService(client)
    return _sdf_service


# ─────────────────────────────────────────────────────────────
# Health & Info Endpoints
# ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """
    Health check endpoint with AI connection status
    
    Returns:
        status: ok/degraded/error
        service: service name
        ai_status: connected/disconnected/not_configured
    """
    ai_status = "not_configured"
    ai_error = None
    
    if settings.GOOGLE_AI_API_KEY:
        try:
            client = get_gemini_client()
            if client:
                # Quick connection test
                connected = await client.test_connection()
                ai_status = "connected" if connected else "disconnected"
            else:
                ai_status = "initialization_failed"
        except Exception as e:
            ai_status = "error"
            ai_error = str(e)
    
    status = "ok" if ai_status == "connected" else "degraded"
    if ai_status == "not_configured":
        status = "degraded"
    
    response = {
        "status": status,
        "service": "ai-gateway",
        "version": "1.0.0",
        "ai_provider": "google-gemini",
        "ai_status": ai_status,
        "model": settings.GEMINI_MODEL,
    }
    
    if ai_error:
        response["ai_error"] = ai_error
    
    return response


@app.get("/")
def root():
    """Root endpoint with API information"""
    return {
        "service": "CustomERP AI Gateway",
        "version": "1.0.0",
        "description": "AI-powered requirement analysis and SDF generation",
        "ai_provider": "Google Gemini 2.5 Pro",
        "api_configured": bool(settings.GOOGLE_AI_API_KEY),
        "endpoints": {
            "health": {
                "method": "GET",
                "path": "/health",
                "description": "Health check with AI connection status"
            },
            "docs": {
                "method": "GET", 
                "path": "/docs",
                "description": "Interactive API documentation (Swagger UI)"
            },
            "test": {
                "method": "POST",
                "path": "/ai/test",
                "description": "Test AI generation (development only)"
            },
            "analyze": {
                "method": "POST",
                "path": "/ai/analyze",
                "description": "Analyze business description (coming in Task D3)"
            },
            "clarify": {
                "method": "POST",
                "path": "/ai/clarify",
                "description": "Process clarification answers (coming in Task D3)"
            },
            "finalize": {
                "method": "POST",
                "path": "/ai/finalize",
                "description": "Generate final SDF (coming in Task D3)"
            }
        }
    }


# ─────────────────────────────────────────────────────────────
# Test Endpoint (Development Only)
# ─────────────────────────────────────────────────────────────

class TestRequest(BaseModel):
    """Request model for AI test endpoint"""
    prompt: str
    temperature: Optional[float] = 0.7


class TestResponse(BaseModel):
    """Response model for AI test endpoint"""
    success: bool
    response: Optional[str] = None
    error: Optional[str] = None
    model: str


@app.post("/ai/test", response_model=TestResponse)
async def test_ai(request: TestRequest):
    """
    Test AI generation with a custom prompt
    
    This endpoint is for development/testing purposes only.
    It allows you to verify the AI connection and test prompts.
    """
    if not settings.GOOGLE_AI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured. Set GOOGLE_AI_API_KEY environment variable."
        )
    
    try:
        client = get_gemini_client()
        if not client:
            raise HTTPException(
                status_code=503,
                detail="Failed to initialize AI client"
            )
        
        response = await client.generate(request.prompt, request.temperature)
        
        return TestResponse(
            success=True,
            response=response,
            model=settings.GEMINI_MODEL
        )
        
    except Exception as e:
        return TestResponse(
            success=False,
            error=str(e),
            model=settings.GEMINI_MODEL
        )


# ─────────────────────────────────────────────────────────────
# Placeholder endpoints for future tasks
# ─────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Request model for the analysis endpoint"""
    business_description: str = Field(..., min_length=50, description="A detailed description of the business requirements.")


@app.post("/ai/analyze", response_model=SystemDefinitionFile)
async def analyze(request: AnalyzeRequest):
    """
    Analyzes a business description and generates a System Definition File (SDF).
    """
    sdf_service = get_sdf_service()
    if not sdf_service:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured or failed to initialize."
        )

    try:
        sdf = await sdf_service.generate_sdf_from_description(request.business_description)
        return sdf
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate a valid SDF: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.post("/ai/clarify")
async def clarify():
    """Placeholder for Task D3 - Process clarification answers"""
    raise HTTPException(
        status_code=501,
        detail="Not implemented yet. Coming in Task D3."
    )


@app.post("/ai/finalize")
async def finalize():
    """Placeholder for Task D3 - Generate final SDF"""
    raise HTTPException(
        status_code=501,
        detail="Not implemented yet. Coming in Task D3."
    )


# ─────────────────────────────────────────────────────────────
# Startup/Shutdown Events
# ─────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    print("=" * 60)
    print("  CustomERP AI Gateway Starting...")
    print("=" * 60)
    print(f"  Model: {settings.GEMINI_MODEL}")
    print(f"  API Key configured: {bool(settings.GOOGLE_AI_API_KEY)}")
    print(f"  Timeout: {settings.AI_TIMEOUT_SECONDS}s")
    print(f"  Max retries: {settings.AI_MAX_RETRIES}")
    print("=" * 60)
    
    # Validate configuration
    errors = settings.validate()
    if errors:
        print("  ⚠️  Configuration warnings:")
        for error in errors:
            print(f"     - {error}")
        print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown tasks"""
    print("AI Gateway shutting down...")
