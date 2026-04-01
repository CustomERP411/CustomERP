#!/usr/bin/env python3
"""
Integration Test: Stateless Feedback Loop

This script simulates a frontend client executing the two-cycle feedback loop:

Cycle 1: POST /ai/analyze
  - Send business description
  - Receive SDF + clarifications_needed

Cycle 2: POST /ai/clarify
  - Send business_description + prefilled_sdf (from Cycle 1) + prior_context (mock answers)
  - Receive refined SDF

Usage:
    python scripts/test_stateless_loop.py [--host HOST] [--port PORT]

Requirements:
    pip install requests
"""

import argparse
import json
import sys
import time
from typing import Any, Dict, Optional

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library not installed. Run: pip install requests")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────

DEFAULT_HOST = "localhost"
DEFAULT_PORT = 8000

SAMPLE_BUSINESS_DESCRIPTION = """
We are a mid-sized manufacturing company called "TechParts Manufacturing" that needs 
a comprehensive ERP system. Our operations include:

**Human Resources:**
- 150 employees across 5 departments (Production, Quality, Warehouse, Sales, Admin)
- We need to track employee information, attendance, and leave requests
- Monthly payroll processing with overtime calculations

**Inventory Management:**
- We manage approximately 2,000 different parts and components
- Multiple warehouse locations (Main Warehouse, Overflow Storage, Shipping Dock)
- Need low-stock alerts and reorder point management
- Track lot numbers for quality traceability

**Invoicing:**
- B2B sales to about 50 regular customers
- Need to generate professional invoices with our company branding
- Support for payment terms (Net 30, Net 60)
- Tax calculations for different regions

We want all modules to share customer and employee data where relevant.
"""


# ─────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────

def print_header(title: str) -> None:
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_json(data: Dict[str, Any], indent: int = 2) -> None:
    """Pretty print JSON data."""
    print(json.dumps(data, indent=indent, default=str))


def make_request(
    method: str,
    url: str,
    json_data: Optional[Dict[str, Any]] = None,
    timeout: int = 120
) -> Optional[Dict[str, Any]]:
    """Make an HTTP request and return JSON response."""
    try:
        print(f"\n[REQUEST] {method} {url}")
        if json_data:
            print(f"[PAYLOAD SIZE] {len(json.dumps(json_data))} bytes")
        
        start_time = time.time()
        
        if method == "GET":
            response = requests.get(url, timeout=timeout)
        elif method == "POST":
            response = requests.post(url, json=json_data, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        elapsed = time.time() - start_time
        print(f"[RESPONSE] Status: {response.status_code} ({elapsed:.2f}s)")
        
        if response.status_code >= 400:
            print(f"[ERROR] {response.text}")
            return None
        
        return response.json()
    
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Could not connect to {url}")
        print("        Is the AI Gateway running? Try: docker-compose up ai-gateway")
        return None
    except requests.exceptions.Timeout:
        print(f"[ERROR] Request timed out after {timeout}s")
        return None
    except Exception as e:
        print(f"[ERROR] {type(e).__name__}: {e}")
        return None


def extract_clarifications(sdf: Dict[str, Any]) -> list:
    """Extract clarification questions from SDF response."""
    return sdf.get("clarifications_needed", [])


def generate_mock_answers(clarifications: list) -> Dict[str, Any]:
    """Generate mock answers for clarification questions."""
    mock_answers = {}
    
    for q in clarifications:
        q_id = q.get("id", "unknown")
        q_type = q.get("type", "text")
        q_text = q.get("question", "")
        options = q.get("options", [])
        
        # Generate contextual mock answers based on question type
        if q_type == "yes_no":
            mock_answers[q_id] = "yes"
        elif q_type == "choice" and options:
            # Pick the first option
            mock_answers[q_id] = options[0]
        else:
            # Generate a generic text answer
            mock_answers[q_id] = f"Mock answer for: {q_text[:50]}..."
    
    return mock_answers


# ─────────────────────────────────────────────────────────────
# Main Test Flow
# ─────────────────────────────────────────────────────────────

def run_cycle_1(base_url: str) -> Optional[Dict[str, Any]]:
    """
    Cycle 1: Initial SDF Generation
    
    POST /ai/analyze with business description
    Returns the generated SDF with clarifications_needed
    """
    print_header("CYCLE 1: Initial SDF Generation (/ai/analyze)")
    
    payload = {
        "business_description": SAMPLE_BUSINESS_DESCRIPTION
    }
    
    sdf = make_request("POST", f"{base_url}/ai/analyze", json_data=payload)
    
    if sdf:
        print("\n[SUCCESS] Cycle 1 complete!")
        print(f"  - Project Name: {sdf.get('project_name', 'N/A')}")
        print(f"  - Entities: {len(sdf.get('entities', []))}")
        print(f"  - Clarifications: {len(extract_clarifications(sdf))}")
        print(f"  - Warnings: {len(sdf.get('warnings', []))}")
    
    return sdf


def run_cycle_2(
    base_url: str,
    business_description: str,
    cycle1_sdf: Dict[str, Any],
    prior_context: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Cycle 2: Refinement with User Answers
    
    POST /ai/clarify with:
    - business_description (original)
    - prefilled_sdf (Cycle 1 output)
    - prior_context (user answers to clarifications)
    
    Returns the refined SDF
    """
    print_header("CYCLE 2: SDF Refinement (/ai/clarify)")
    
    payload = {
        "business_description": business_description,
        "prefilled_sdf": cycle1_sdf,
        "prior_context": prior_context
    }
    
    sdf = make_request("POST", f"{base_url}/ai/clarify", json_data=payload)
    
    if sdf:
        print("\n[SUCCESS] Cycle 2 complete!")
        print(f"  - Project Name: {sdf.get('project_name', 'N/A')}")
        print(f"  - Entities: {len(sdf.get('entities', []))}")
        print(f"  - Remaining Clarifications: {len(extract_clarifications(sdf))}")
        print(f"  - Warnings: {len(sdf.get('warnings', []))}")
    
    return sdf


def main():
    parser = argparse.ArgumentParser(
        description="Test the stateless feedback loop for CustomERP AI Gateway"
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"API Gateway host (default: {DEFAULT_HOST})"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"API Gateway port (default: {DEFAULT_PORT})"
    )
    parser.add_argument(
        "--skip-cycle2",
        action="store_true",
        help="Only run Cycle 1 (skip clarification cycle)"
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Save final SDF to this file (JSON)"
    )
    
    args = parser.parse_args()
    base_url = f"http://{args.host}:{args.port}"
    
    print_header("STATELESS FEEDBACK LOOP TEST")
    print(f"Target: {base_url}")
    
    # Health check
    print("\n[INFO] Checking API health...")
    health = make_request("GET", f"{base_url}/health")
    if not health:
        print("\n[FATAL] API Gateway is not responding. Exiting.")
        sys.exit(1)
    print(f"[OK] API is healthy: {health}")
    
    # ─────────────────────────────────────────────────────────
    # Cycle 1: Initial Generation
    # ─────────────────────────────────────────────────────────
    cycle1_sdf = run_cycle_1(base_url)
    
    if not cycle1_sdf:
        print("\n[FATAL] Cycle 1 failed. Exiting.")
        sys.exit(1)
    
    # Extract clarifications for Cycle 2
    clarifications = extract_clarifications(cycle1_sdf)
    
    if args.skip_cycle2:
        print("\n[INFO] Skipping Cycle 2 (--skip-cycle2 flag)")
        final_sdf = cycle1_sdf
    elif not clarifications:
        print("\n[INFO] No clarifications needed. Skipping Cycle 2.")
        final_sdf = cycle1_sdf
    else:
        # ─────────────────────────────────────────────────────
        # Display Clarifications
        # ─────────────────────────────────────────────────────
        print_header("CLARIFICATION QUESTIONS FROM CYCLE 1")
        for i, q in enumerate(clarifications, 1):
            print(f"\n  Q{i} [{q.get('id')}] ({q.get('type')}):")
            print(f"      {q.get('question')}")
            if q.get('options'):
                print(f"      Options: {q.get('options')}")
            if q.get('module'):
                print(f"      Module: {q.get('module')}")
        
        # ─────────────────────────────────────────────────────
        # Generate Mock Answers
        # ─────────────────────────────────────────────────────
        print_header("MOCK ANSWERS (prior_context)")
        mock_answers = generate_mock_answers(clarifications)
        print_json(mock_answers)
        
        # ─────────────────────────────────────────────────────
        # Cycle 2: Refinement
        # ─────────────────────────────────────────────────────
        final_sdf = run_cycle_2(
            base_url=base_url,
            business_description=SAMPLE_BUSINESS_DESCRIPTION,
            cycle1_sdf=cycle1_sdf,
            prior_context=mock_answers
        )
        
        if not final_sdf:
            print("\n[FATAL] Cycle 2 failed. Exiting.")
            sys.exit(1)
    
    # ─────────────────────────────────────────────────────────
    # Final Output
    # ─────────────────────────────────────────────────────────
    print_header("FINAL SDF SUMMARY")
    
    print(f"\nProject: {final_sdf.get('project_name', 'N/A')}")
    print(f"\nModules:")
    modules = final_sdf.get('modules', {})
    for mod, config in modules.items():
        enabled = config.get('enabled', False) if isinstance(config, dict) else config
        print(f"  - {mod}: {'enabled' if enabled else 'disabled'}")
    
    print(f"\nEntities ({len(final_sdf.get('entities', []))}):")
    for entity in final_sdf.get('entities', []):
        name = entity.get('name', 'unknown')
        fields = entity.get('fields', [])
        print(f"  - {name} ({len(fields)} fields)")
    
    if final_sdf.get('warnings'):
        print(f"\nWarnings ({len(final_sdf.get('warnings', []))}):")
        for warn in final_sdf.get('warnings', []):
            print(f"  - {warn}")
    
    # Save to file if requested
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(final_sdf, f, indent=2)
        print(f"\n[SAVED] Final SDF written to: {args.output}")
    
    print_header("TEST COMPLETE")
    print("\n[OK] Stateless feedback loop executed successfully!")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
