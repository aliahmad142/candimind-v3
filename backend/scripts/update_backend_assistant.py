import httpx
import asyncio
import json
import os
from config import get_settings

settings = get_settings()

async def update_backend_assistant():
    assistant_id = settings.vapi_assistant_backend_id
    api_key = settings.vapi_api_key
    
    # Read the schema file
    file_path = os.path.join(os.path.dirname(__file__), "..", "vapi-prompts", "backend-structured-output-schema.json")
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "vapi-prompts", "backend-typescript-prompt.md")
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            schema = json.load(f)
            print(f"✅ Loaded schema from {file_path}")
            
        with open(prompt_path, "r", encoding="utf-8") as f:
            system_prompt = f.read()
            print(f"✅ Loaded system prompt from {prompt_path}")
            
    except Exception as e:
        print(f"❌ Failed to load files: {str(e)}")
        return

    # Prepare payload update
    # Note: VAPI expects specific structure for tools/functions
    # We must also ensure the model supports functions (e.g. gpt-4)
    
    function_def = {
        "name": "Interview_Evaluation",
        "description": "Structure the interview evaluation results",
        "parameters": schema
    }
    
    payload = {
        "model": {
            "provider": "openai",
            "model": "gpt-4",
            "messages": [
                {
                    "content": system_prompt,
                    "role": "system"
                }
            ],
            "functions": [function_def],
            "toolIds": [] # Clear existing tools if any to avoid conflicts
        }
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    print(f"\nUpdating Backend Assistant (ID: {assistant_id})...")
    print(f"Setting model to GPT-4 with structured output schema...")
    
    async with httpx.AsyncClient() as client:
        try:
            # First clean any existing tools to avoid conflict
            # We are patching, so VAPI merges. To overwrite, might need cleaner approach.
            # But let's try patching the model configuration.
            
            response = await client.patch(
                f"https://api.vapi.ai/assistant/{assistant_id}",
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                print("✅ Successfully updated Backend Assistant configuration!")
                print("JSON Schema has been applied.")
                print(f"Response: {response.json().get('id')}")
            else:
                print(f"❌ Failed to update assistant: {response.status_code}")
                try:
                    print(response.json())
                except:
                    print(response.text)
                    
        except Exception as e:
            print(f"❌ Error during API call: {str(e)}")

if __name__ == "__main__":
    if not settings.vapi_api_key or not settings.vapi_assistant_backend_id:
        print("❌ Missing API config in .env")
    else:
        asyncio.run(update_backend_assistant())
