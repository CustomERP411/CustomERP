"""
CustomERP AI Gateway
FastAPI service for AI-powered SDF generation using Google Gemini
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, AliasChoices
from typing import Optional, Union, Any, Dict
import os
import asyncio
from fastapi.responses import PlainTextResponse

from .config import settings
from .services.gemini_client import GeminiClient
from .services.sdf_service import SDFService
from .schemas.sdf import SystemDefinitionFile
from .schemas.clarify import ClarifyRequest

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
        _gemini_client = GeminiClient.get_instance()
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

@app.get("/health", tags=["Monitoring"])
async def health_check():
    """Simple health check endpoint for Docker."""
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────
# Core AI Endpoints
# ─────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Request model for the analysis endpoint"""
    # Compatibility:
    # - Sprint plan uses `description`
    # - Current gateway uses `business_description`
    business_description: str = Field(
        ...,
        min_length=50,
        description="A detailed description of the business requirements.",
        validation_alias=AliasChoices("business_description", "description"),
    )
    prior_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional prior context for the AI (reserved for future use).",
    )


class EditRequest(BaseModel):
    """Request model for applying change instructions to an existing SDF."""
    business_description: Optional[str] = None
    current_sdf: SystemDefinitionFile
    instructions: str = Field(..., min_length=3)


@app.post("/ai/analyze", response_model=SystemDefinitionFile, response_model_exclude_none=True, tags=["SDF Generation"])
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
        print(f"[ERROR] Unexpected error in /ai/analyze: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.post("/ai/clarify", response_model=SystemDefinitionFile, response_model_exclude_none=True, tags=["SDF Generation"])
async def clarify_sdf_endpoint(request: ClarifyRequest):
    """
    Refines an SDF based on user answers to clarification questions.
    """
    sdf_service = get_sdf_service()
    if not sdf_service:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured or failed to initialize."
        )
    try:
        refined_sdf = await sdf_service.clarify_sdf(
            business_description=request.business_description or "",
            partial_sdf=request.partial_sdf,
            answers=request.answers
        )
        return refined_sdf
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Unexpected error in /ai/clarify: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.post("/ai/finalize", response_model=SystemDefinitionFile, response_model_exclude_none=True, tags=["SDF Generation"])
async def finalize_sdf_endpoint(payload: Union[SystemDefinitionFile, ClarifyRequest]):
    """
    Finalizes the SDF.
    If payload is ClarifyRequest (partial_sdf + answers), it merges answers and produces a final SDF.
    If payload is SystemDefinitionFile (already final), it validates and returns it.
    """
    print("[FINALIZE] Received request.")
    
    if isinstance(payload, SystemDefinitionFile):
        # Already final, just return it (validation handled by Pydantic response_model)
        return payload

    # It's a ClarifyRequest, so we need to merge answers
    sdf_service = get_sdf_service()
    if not sdf_service:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured or failed to initialize."
        )

    try:
        final_sdf = await sdf_service.finalize_sdf(
            business_description=payload.business_description or "",
            partial_sdf=payload.partial_sdf,
            answers=payload.answers
        )
        return final_sdf
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Unexpected error in /ai/finalize: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.post("/ai/edit", response_model=SystemDefinitionFile, response_model_exclude_none=True, tags=["SDF Generation"])
async def edit_sdf_endpoint(request: EditRequest):
    """
    Applies a change request (instructions) to an existing generator SDF.
    """
    sdf_service = get_sdf_service()
    if not sdf_service:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured or failed to initialize."
        )

    try:
        updated = await sdf_service.edit_sdf(
            business_description=request.business_description or "",
            current_sdf=request.current_sdf,
            instructions=request.instructions
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Unexpected error in /ai/edit: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.get("/test", tags=["Testing"], response_class=PlainTextResponse)
async def run_integration_test():
    """
    Triggers the integration test suite.
    
    This endpoint runs the `test_integration.py` script in a separate process.
    The output of the test will be streamed to the Docker logs for this service.
    """
    print("\n" + "="*60)
    print("  🚀 TRIGGERING INTEGRATION TEST VIA API ENDPOINT 🚀")
    print("="*60)
    
    process = await asyncio.create_subprocess_exec(
        "python", "-u", "tests/test_integration.py",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    async def stream_logs(stream, prefix):
        while True:
            line = await stream.readline()
            if not line:
                break
            print(f"{prefix}: {line.decode().strip()}")

    # Run streamers in parallel
    await asyncio.gather(
        stream_logs(process.stdout, "[TEST_STDOUT]"),
        stream_logs(process.stderr, "[TEST_STDERR]")
    )

    await process.wait()
    
    return "Integration test started. Check Docker logs for output."


# ─────────────────────────────────────────────────────────────
# Startup/Shutdown Events
# ─────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    print("=" * 60)
    print("  CustomERP AI Gateway Starting...")
    print("=" * 60)
    # Attempt to initialize the client on startup to check config
    get_gemini_client()
    client = get_gemini_client()
    if client:
        info = client.get_model_info()
        print(f"  Model: {info.get('model')}")
        print(f"  API Key configured: {info.get('api_configured')}")
        print(f"  Timeout: {info.get('timeout_seconds')}s")
        print(f"  Max retries: {info.get('max_retries')}")
    else:
        print("  ⚠️  AI Client could not be initialized. Check GOOGLE_AI_API_KEY.")
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown tasks"""
    print("AI Gateway shutting down...")
