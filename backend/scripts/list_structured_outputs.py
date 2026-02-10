import httpx
import asyncio
import json
import os
from config import get_settings

settings = get_settings()

async def list_structured_outputs():
    api_key = settings.vapi_api_key
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    print(f"\nListing Structured Outputs...")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://api.vapi.ai/structured-output",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                print(json.dumps(data, indent=2))
            else:
                print(f"❌ Failed to list structured outputs: {response.status_code}")
                print(response.text)
                    
        except Exception as e:
            print(f"❌ Error during API call: {str(e)}")

if __name__ == "__main__":
    if not settings.vapi_api_key:
        print("❌ Missing API config in .env")
    else:
        asyncio.run(list_structured_outputs())
