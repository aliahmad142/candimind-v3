import httpx
import asyncio
import json
import sys
import os

# Fix path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_settings

settings = get_settings()

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

async def check_assistant_config():
    assistants = {
        "Frontend": settings.vapi_assistant_frontend_id,
        "Backend": settings.vapi_assistant_backend_id
    }
    
    headers = {
        "Authorization": f"Bearer {settings.vapi_api_key}",
        "Content-Type": "application/json"
    }
    
    print(f"Checking configuration for Assistants...")
    print(f"API Key: {settings.vapi_api_key[:5]}...{settings.vapi_api_key[-5:]}")
    
    async with httpx.AsyncClient() as client:
        for role, assistant_id in assistants.items():
            print(f"\n{'='*50}")
            print(f"Checking {role} Assistant (ID: {assistant_id})")
            print(f"{'='*50}")
            
            try:
                response = await client.get(
                    f"https://api.vapi.ai/assistant/{assistant_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    model = data.get("model", {})
                    server = data.get("server", {})
                    
                    print(f"✅ Assistant Found!")
                    print(f"Name: {data.get('name', 'Unnamed')}")
                    print(f"Server URL: {server.get('url') if server else 'None'}")
                    print(f"Model: {model.get('model')}")
                    
                    # Check Structured Output
                    artifact_plan = data.get("artifactPlan", {})
                    structured_outputs = artifact_plan.get("structuredOutputIds", [])
                    print(f"Structured Output IDs: {structured_outputs}")
                    
                    if structured_outputs:
                        for so_id in structured_outputs:
                            so_resp = await client.get(f"https://api.vapi.ai/structured-output/{so_id}", headers=headers)
                            if so_resp.status_code == 200:
                                so_n = so_resp.json().get("name")
                                print(f"  -> Schema Name: {so_n}")
                                print(f"  -> Schema ID: {so_id}")
                            else:
                                print(f"  -> Failed to fetch schema: {so_resp.status_code}")

                else:
                    print(f"❌ Failed to fetch assistant: {response.status_code}")
                    print(response.text)
                    
            except Exception as e:
                print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(check_assistant_config())
