"""
CustomERP AI Gateway
FastAPI service for AI-powered SDF generation using Google Gemini
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, AliasChoices
from typing import Optional, Union, Any, Dict, List
import json
import os
import asyncio
from fastapi.responses import PlainTextResponse

from .config import settings
from .services.gemini_client import GeminiClient
from .services.azure_client import AzureOpenAIClient
from .services.sdf_service import SDFService
from .services.base_client import BaseAIClient
from .schemas.sdf import SystemDefinitionFile
from .schemas.clarify import ClarifyRequest
from .prompts.sdf_generation import get_chat_prompt

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
    default_question_answers: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Answers to mandatory pre-generation questions.",
    )
    prefilled_sdf: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Prefilled SDF draft built from mandatory answers.",
    )


class EditRequest(BaseModel):
    """Request model for applying change instructions to an existing SDF."""
    business_description: Optional[str] = None
    current_sdf: SystemDefinitionFile
    instructions: str = Field(..., min_length=3)


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str

class ChatRequest(BaseModel):
    """Request model for the chat mode endpoint (feature discussion, not SDF generation)."""
    business_description: str = Field(default="", description="Overall business description from the project.")
    message: str = Field(..., min_length=1, description="The user's current chat message.")
    conversation_history: List[ChatMessage] = Field(default_factory=list, description="Prior chat exchanges.")
    selected_modules: List[str] = Field(default_factory=list, description="Modules the user has selected so far.")
    business_answers: Optional[Dict[str, Any]] = Field(default=None, description="Answers to business questions so far.")

class ChatResponse(BaseModel):
    reply: str
    suggested_modules: List[str] = Field(default_factory=list)
    discussion_points: List[str] = Field(default_factory=list)
    confidence: str = "medium"


_chatbot_client: Optional[BaseAIClient] = None

def get_chatbot_client() -> Optional[BaseAIClient]:
    """Get or create the chatbot AI client singleton."""
    global _chatbot_client
    if _chatbot_client is None:
        config = settings.get_agent_config("chatbot")
        if config.provider == "azure_openai":
            try:
                _chatbot_client = AzureOpenAIClient(agent_config=config)
            except Exception as e:
                print(f"[ChatBot] Azure client init failed: {e}")
                if settings.GOOGLE_AI_API_KEY:
                    print("[ChatBot] Falling back to Gemini")
                    config.provider = "gemini"
                    _chatbot_client = GeminiClient(agent_config=config)
                else:
                    return None
        else:
            if not settings.GOOGLE_AI_API_KEY:
                return None
            _chatbot_client = GeminiClient(agent_config=config)
    return _chatbot_client


@app.post("/ai/chat", response_model=ChatResponse, tags=["Chat Mode"])
async def chat_endpoint(request: ChatRequest):
    """
    Chat mode endpoint for conversational feature discussion.

    Uses the chatbot agent to help users explore and refine their ERP requirements
    before switching to build mode. Does NOT generate SDF output.
    """
    client = get_chatbot_client()
    if not client:
        raise HTTPException(
            status_code=503,
            detail="Chat AI service is not configured or failed to initialize."
        )

    history_str = ""
    if request.conversation_history:
        lines = []
        for msg in request.conversation_history[-10:]:
            lines.append(f"{msg.role.upper()}: {msg.content}")
        history_str = "\n".join(lines)

    answers_str = ""
    if request.business_answers:
        parts = []
        for key, val in request.business_answers.items():
            if isinstance(val, dict):
                parts.append(f"- {val.get('question', key)}: {val.get('answer', '')}")
            else:
                parts.append(f"- {key}: {val}")
        answers_str = "\n".join(parts)

    modules_str = ", ".join(request.selected_modules) if request.selected_modules else ""

    prompt = get_chat_prompt(
        business_description=request.business_description,
        user_message=request.message,
        selected_modules=modules_str,
        business_answers=answers_str,
        conversation_history=history_str,
    )

    try:
        config = settings.get_agent_config("chatbot")
        result = await client.generate_with_retry(
            prompt, temperature=config.temperature, json_mode=True,
        )

        data = _parse_chat_json(result.text)
        return ChatResponse(
            reply=data.get("reply", "I'm sorry, I couldn't generate a response. Please try again."),
            suggested_modules=data.get("suggested_modules", []),
            discussion_points=data.get("discussion_points", []),
            confidence=data.get("confidence", "medium"),
        )
    except Exception as e:
        print(f"[ERROR] Unexpected error in /ai/chat: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


def _parse_chat_json(text: str) -> dict:
    """Extract a JSON object from the chatbot's response text."""
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        return {"reply": text.strip()}
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return {"reply": text.strip()}


@app.post("/ai/analyze", response_model=SystemDefinitionFile, response_model_exclude_none=True, tags=["SDF Generation"])
async def analyze(request: AnalyzeRequest):
    """
    Analyzes a business description and generates a System Definition File (SDF).
    
    Uses a multi-agent pipeline with specialized AI agents for:
    - Distributor: Routes input to appropriate modules
    - HR Generator: Generates HR-related entities
    - Invoice Generator: Generates Invoice-related entities
    - Inventory Generator: Generates Inventory-related entities
    - Integrator: Combines all module outputs into final SDF
    """
    sdf_service = get_sdf_service()
    if not sdf_service:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured or failed to initialize."
        )

    try:
        print("[API] Generating SDF using multi-agent pipeline")
        sdf = await sdf_service.generate_sdf_multi_agent(
            business_description=request.business_description,
            default_question_answers=request.default_question_answers,
            prefilled_sdf=request.prefilled_sdf,
        )
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
    
    Implements the stateless feedback loop (Cycle 2+):
    - Takes the previous SDF state (prefilled_sdf)
    - Takes user answers to clarifying questions (prior_context)
    - Re-runs the multi-agent pipeline with full context
    - Returns an updated SDF that APPENDS to existing state
    """
    sdf_service = get_sdf_service()
    if not sdf_service:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured or failed to initialize."
        )
    
    try:
        # Merge prior_context with legacy answers format
        merged_context = request.get_merged_context()
        
        print(f"[API] /ai/clarify - Cycle 2+ with {len(merged_context)} answers")
        
        # Use multi-agent pipeline with prior context injected
        refined_sdf = await sdf_service.generate_sdf_multi_agent(
            business_description=request.business_description,
            default_question_answers=merged_context,
            prefilled_sdf=request.prefilled_sdf,
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
    print(f"  Default provider: {settings.AI_DEFAULT_PROVIDER}")
    print("=" * 60)

    has_azure = bool(settings.AZURE_OPENAI_API_KEY and settings.AZURE_OPENAI_ENDPOINT)
    has_gemini = bool(settings.GOOGLE_AI_API_KEY)
    print(f"  Azure OpenAI configured: {has_azure}")
    print(f"  Google Gemini configured: {has_gemini}")

    get_gemini_client()
    client = get_gemini_client()
    if client:
        info = client.get_model_info()
        print(f"  Gemini model: {info.get('model')}")

    validation_errors = settings.validate()
    if validation_errors:
        for err in validation_errors:
            print(f"  WARNING: {err}")
    else:
        print("  Configuration OK")
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown tasks"""
    print("AI Gateway shutting down...")
