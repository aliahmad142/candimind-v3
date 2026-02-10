import httpx
import asyncio
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_settings

settings = get_settings()

async def fix_frontend():
    headers = {
        "Authorization": f"Bearer {settings.vapi_api_key}",
        "Content-Type": "application/json"
    }

    print("🔍 Looking for 'Interview_Evaluation' schema...")
    
    frontend_schema_id = None
    
    async with httpx.AsyncClient() as client:
        # 1. List Structured Outputs
        resp = await client.get("https://api.vapi.ai/structured-output", headers=headers)
        if resp.status_code == 200:
            schemas = resp.json()
            print(f"DEBUG: Response Type: {type(schemas)}")
            if isinstance(schemas, list):
                if schemas:
                    print(f"DEBUG: First item type: {type(schemas[0])}")
                    print(f"DEBUG: First item keys: {schemas[0].keys() if isinstance(schemas[0], dict) else 'Not Dict'}")
            else:
                print(f"DEBUG: Content: {schemas}")
            
            if isinstance(schemas, list):
                for s in schemas:
                    if not isinstance(s, dict):
                        continue
                    if s.get("name") == "Interview_Evaluation":
                        print(f"✅ Found existing schema: {s.get('id')}")
                        frontend_schema_id = s.get("id")
                        break
        
        # 2. If not found, create it
        if not frontend_schema_id:
            print("⚠️ Schema not found. Creating new one...")
            with open(r"C:\Users\HP\Documents\Candimind\vapi-prompts\frontend-structured-output-schema.json", "r") as f:
                schema_body = json.load(f)
            
            payload = {
                "name": "Interview_Evaluation",
                "schema": schema_body
            }
            
            create_resp = await client.post("https://api.vapi.ai/structured-output", json=payload, headers=headers)
            if create_resp.status_code == 201:
                frontend_schema_id = create_resp.json().get("id")
                print(f"✅ Created new schema: {frontend_schema_id}")
            else:
                print(f"❌ Failed to create schema: {create_resp.text}")
                return

        # 3. Update Frontend Assistant
        assistant_id = settings.vapi_assistant_frontend_id
        print(f"🔄 Updating Frontend Assistant ({assistant_id})...")
        
        update_payload = {
            "artifactPlan": {
                "structuredOutputIds": [frontend_schema_id]
            }
        }
        
        patch_resp = await client.patch(
            f"https://api.vapi.ai/assistant/{assistant_id}",
            json=update_payload,
            headers=headers
        )
        
        if patch_resp.status_code == 200:
            print("✅ Frontend Assistant Updated Successfully!")
            print(f"Linked to Schema ID: {frontend_schema_id}")
        else:
            print(f"❌ Failed to update assistant: {patch_resp.text}")

if __name__ == "__main__":
    asyncio.run(fix_frontend())
