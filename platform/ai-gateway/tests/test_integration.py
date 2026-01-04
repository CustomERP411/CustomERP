# tests/test_integration.py
import httpx
import asyncio
import os

# Get the base URL from an environment variable or default to localhost
BASE_URL = os.getenv("AI_GATEWAY_URL", "http://localhost:8000")

async def test_full_flow():
    """Tests the full analyze -> clarify -> finalize workflow."""
    print("\n" + "="*60)
    print("  RUNNING AI GATEWAY INTEGRATION TEST")
    print("="*60)
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=120.0) as client:
        # -------------------------------------------
        # 1. Initial Analysis
        # -------------------------------------------
        print("\n[Step 1/3] Analyzing business description...")
        business_description = "I need a system to manage an online store. I have customers who can place orders. Each order is made up of several products. I need to track the customer's name and email. For products, I need to track the name, price, and how many are in stock. An order has a date and should belong to a customer. Each line item in an order should record the quantity of the product and the price it was sold at."
        
        try:
            response = await client.post("/ai/analyze", json={
                "business_description": business_description
            })
            response.raise_for_status() # Raise an exception for 4xx/5xx responses
            
            initial_sdf = response.json()
            print("[Step 1/3] Analysis successful. Received initial SDF.")
            assert "entities" in initial_sdf
            assert len(initial_sdf["entities"]) > 0
            
        except httpx.HTTPStatusError as e:
            print(f"[Step 1/3] FAILED: HTTP error occurred: {e.response.status_code} - {e.response.text}")
            return
        except Exception as e:
            print(f"[Step 1/3] FAILED: An unexpected error occurred: {e}")
            return

        # -------------------------------------------
        # 2. Clarification
        # -------------------------------------------
        if initial_sdf.get("clarifications_needed"):
            print("\n[Step 2/3] Answering clarification questions...")
            questions = initial_sdf["clarifications_needed"]
            print(f"  > Found {len(questions)} question(s) from the AI.")

            # Create answers. This is a simple test, so we provide a generic answer.
            answers = []
            for q in questions:
                if q["id"] == "order_status":
                    answers.append({"question_id": q["id"], "answer": "An order can have the statuses: pending, processing, shipped, delivered, or cancelled."})
                else:
                    # Generic answer for other potential questions
                    answers.append({"question_id": q["id"], "answer": "Yes, that is correct."})

            try:
                clarify_response = await client.post("/ai/clarify", json={
                    "business_description": business_description,
                    "partial_sdf": initial_sdf,
                    "answers": answers
                })
                clarify_response.raise_for_status()
                
                refined_sdf = clarify_response.json()
                print("[Step 2/3] Clarification successful. Received refined SDF.")
                assert "entities" in refined_sdf
                # Check that the status field was added to the order entity
                order_entity = next((e for e in refined_sdf["entities"] if e["slug"] == "order"), None)
                assert order_entity is not None
                status_field = next((f for f in order_entity["fields"] if f["name"] == "status"), None)
                assert status_field is not None

            except httpx.HTTPStatusError as e:
                print(f"[Step 2/3] FAILED: HTTP error occurred: {e.response.status_code} - {e.response.text}")
                return
            except Exception as e:
                print(f"[Step 2/3] FAILED: An unexpected error occurred: {e}")
                return
        else:
            print("\n[Step 2/3] SKIPPED: No clarification questions asked.")
            refined_sdf = initial_sdf # Use the initial SDF if no clarification was needed

        # -------------------------------------------
        # 3. Finalization
        # -------------------------------------------
        print("\n[Step 3/3] Finalizing the SDF...")
        try:
            finalize_response = await client.post("/ai/finalize", json=refined_sdf)
            finalize_response.raise_for_status()
            final_sdf = finalize_response.json()
            
            print("[Step 3/3] Finalization successful.")
            assert final_sdf == refined_sdf # Finalize should return the same SDF

        except httpx.HTTPStatusError as e:
            print(f"[Step 3/3] FAILED: HTTP error occurred: {e.response.status_code} - {e.response.text}")
            return
        except Exception as e:
            print(f"[Step 3/3] FAILED: An unexpected error occurred: {e}")
            return
        
        print("\n" + "="*60)
        print("  ✅ INTEGRATION TEST PASSED SUCCESSFULLY")
        print("="*60)

if __name__ == "__main__":
    print("Starting integration test against AI Gateway...")
    asyncio.run(test_full_flow())
