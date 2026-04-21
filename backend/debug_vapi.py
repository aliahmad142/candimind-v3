import asyncio
import httpx
import json
import os
import sys

# Add current directory to path so we can import config
sys.path.append(os.getcwd())
from config import get_settings

async def main():
    settings = get_settings()
    headers = {"Authorization": f"Bearer {settings.vapi_api_key}"}
    async with httpx.AsyncClient() as client:
        r = await client.get("https://api.vapi.ai/call?limit=20", headers=headers)
        if r.status_code != 200:
            print(f"Error: {r.status_code} - {r.text}")
            return
        
        calls = r.json()
        print(f"Checking {len(calls)} recent calls...")
        for i, call in enumerate(calls):
            cid = call.get("id")
            status = call.get("status")
            metadata = call.get("metadata", {}) or {}
            customer = call.get("customer", {}) or {}
            name = customer.get("name", "N/A")
            interview_id = metadata.get("interviewId", "NONE")
            
            print(f"[{i}] {cid} | {status} | Name: {name} | Metadata: {interview_id}")

if __name__ == "__main__":
    asyncio.run(main())
