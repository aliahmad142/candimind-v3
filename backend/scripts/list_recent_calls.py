import httpx
import asyncio
import json
import sys
import os
from datetime import datetime

# Fix path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_settings

settings = get_settings()

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

async def list_recent_calls():
    headers = {
        "Authorization": f"Bearer {settings.vapi_api_key}",
        "Content-Type": "application/json"
    }

    print(f"Fetching recent calls from VAPI...")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://api.vapi.ai/call?limit=10",
                headers=headers
            )
            
            if response.status_code == 200:
                calls = response.json()
                print(f"Found {len(calls)} calls.\n")
                
                for call in calls:
                    call_id = call.get("id")
                    status = call.get("status")
                    started_at = call.get("startedAt")
                    ended_at = call.get("endedAt")
                    analysis = call.get("analysis", {})
                    summary = analysis.get("summary", "No summary")
                    
                    # Try to get structured output result
                    artifact = call.get("artifact", {})
                    structured_outputs = artifact.get("structuredOutputs", {})
                    has_results = len(structured_outputs) > 0
                    
                    print(f"ID: {call_id}")
                    print(f"Time: {started_at}")
                    print(f"Status: {status}")
                    print(f"Results Available: {has_results}")
                    print(f"Summary: {summary[:100]}...")
                    print("-" * 50)
                    
            else:
                print(f"❌ Failed to fetch calls: {response.status_code}")
                print(response.text)
                    
        except Exception as e:
            print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(list_recent_calls())
