import httpx
import asyncio
import json
import os
from config import get_settings

settings = get_settings()

async def test_fetch_call_details(call_id):
    api_key = settings.vapi_api_key
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    print(f"\nFetching Call Details for {call_id}...")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"https://api.vapi.ai/call/{call_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                call_details = response.json()
                # print(json.dumps(call_details, indent=2))
                
                # Test Parsing Logic
                structured_outputs = call_details.get("artifact", {}).get("structuredOutputs", {})
                print(f"Found {len(structured_outputs)} structured outputs.")
                
                evaluation_data = None
                parsed_name = None
                
                for output_id, output_data in structured_outputs.items():
                    name = output_data.get("name")
                    print(f"Checking Output ID {output_id} with name: '{name}'")
                    
                    if name in ["Interview_Evaluation", "Backend_Interview_Evaluation"]:
                        evaluation_data = output_data.get("result")
                        parsed_name = name
                        break
                
                if evaluation_data:
                    print(f"✅ SUCCESS! Extracted data for '{parsed_name}'")
                    print("Data keys:", evaluation_data.keys())
                    print("Overall Score:", evaluation_data.get("overall_score"))
                    print("Backend Depth:", evaluation_data.get("backend_technical_depth"))
                else:
                    print("❌ FAILED to extract evaluation data.")
                    print("Available structured outputs:", structured_outputs)
                    
            else:
                print(f"❌ Failed to fetch call: {response.status_code}")
                print(response.text)
                    
        except Exception as e:
            print(f"❌ Error during API call: {str(e)}")

if __name__ == "__main__":
    # Call ID from grep logs
    call_id = "019c474f-faae-7bb4-ad3f-5b7eaff84057"
    asyncio.run(test_fetch_call_details(call_id))
