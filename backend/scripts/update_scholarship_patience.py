import httpx
import asyncio
import os
import sys

# Fix path to import from parent
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_settings

settings = get_settings()

async def update_scholarship_patience():
    assistant_id = settings.vapi_scholarship_assistant_id
    api_key = settings.vapi_api_key
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Set to max allowed 500ms
    payload = {
        "transcriber": {
            "provider": "deepgram",
            "model": "flux-general-en",
            "language": "en",
            "endpointing": 500
        }
    }
    
    print(f"Updating Scholarship Assistant {assistant_id} with 2-second patience...")
    
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"https://api.vapi.ai/assistant/{assistant_id}",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            print("Successfully updated assistant configuration permanently!")
            print("The 2-second wait time is now built-in.")
        else:
            print(f"Failed to update assistant: {response.status_code}")
            print(response.text)

if __name__ == "__main__":
    if not settings.vapi_api_key or not settings.vapi_scholarship_assistant_id:
        print("❌ Missing VAPI_API_KEY or VAPI_SCHOLARSHIP_ASSISTANT_ID in .env")
    else:
        asyncio.run(update_scholarship_patience())
