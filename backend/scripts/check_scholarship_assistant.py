import httpx
import asyncio
import os
import sys

# Fix path to import from parent
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_settings

settings = get_settings()

async def check_scholarship_config():
    assistant_id = settings.vapi_scholarship_assistant_id
    headers = {
        "Authorization": f"Bearer {settings.vapi_api_key}",
        "Content-Type": "application/json"
    }
    
    print(f"Checking Scholarship Assistant: {assistant_id}")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.vapi.ai/assistant/{assistant_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            import json
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Error: {response.status_code}")
            print(response.text)

if __name__ == "__main__":
    asyncio.run(check_scholarship_config())
