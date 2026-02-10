import httpx
import asyncio
import json
import os
from config import get_settings

settings = get_settings()

async def fix_backend_assistant():
    api_key = settings.vapi_api_key
    assistant_id = settings.vapi_assistant_backend_id
    
    # Read the schema file
    file_path = os.path.join(os.path.dirname(__file__), "..", "vapi-prompts", "backend-structured-output-schema.json")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            schema = json.load(f)
            print(f"✅ Loaded schema from {file_path}")
    except Exception as e:
        print(f"❌ Failed to load schema: {str(e)}")
        return

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    # 1. Check for existing Structured Output
    print(f"\nChecking for existing Structured Output...")
    
    schema_id = None
    existing_schema_name = "Backend_Interview_Evaluation"
    
    async with httpx.AsyncClient() as client:
        try:
            # List existing
            list_resp = await client.get("https://api.vapi.ai/structured-output", headers=headers)
            if list_resp.status_code == 200:
                existing_list = list_resp.json()
                # Handle pagination results key if present, or list directly
                results = existing_list if isinstance(existing_list, list) else existing_list.get('results', [])
                
                for item in results:
                    if item.get('name') == existing_schema_name:
                        schema_id = item.get('id')
                        print(f"✅ Found existing Structured Output ID: {schema_id}")
                        break
            
            # Create if not found
            if not schema_id:
                print(f"Creating new Structured Output: {existing_schema_name}...")
                structured_output_payload = {
                    "name": existing_schema_name,
                    "description": "Evaluation schema for Backend Developer candidates",
                    "schema": schema
                }
                
                response = await client.post(
                    "https://api.vapi.ai/structured-output",
                    headers=headers,
                    json=structured_output_payload
                )
                
                if response.status_code == 201:
                    data = response.json()
                    schema_id = data.get("id")
                    print(f"✅ Created Structured Output Schema. ID: {schema_id}")
                else:
                    print(f"❌ Failed to create schema: {response.status_code}")
                    print(response.text)
                    return

            # 2. Update Assistant to use this Schema
            print(f"\nUpdating Backend Assistant (ID: {assistant_id}) to use Schema ID: {schema_id}")
            
            # First, fetch current assistant to get current model config
            get_resp = await client.get(f"https://api.vapi.ai/assistant/{assistant_id}", headers=headers)
            current_assistant = get_resp.json()
            model_config = current_assistant.get("model", {})
            
            # Remove functions if present
            if "functions" in model_config:
                print("Removing legacy functions from model config...")
                del model_config["functions"]
            
            # Ensure model is GPT-4
            model_config["model"] = "gpt-4"
            
            # CRITICAL: Preserve messages (System Prompt)
            # The 'model_config' retrieved from API includes 'messages', so we are good.
            
            update_payload = {
                "model": model_config,
                "artifactPlan": {
                    "structuredOutputIds": [schema_id]
                }
            }
            
            response = await client.patch(
                f"https://api.vapi.ai/assistant/{assistant_id}",
                headers=headers,
                json=update_payload
            )
            
            if response.status_code == 200:
                print("✅ Successfully updated Backend Assistant configuration!")
                print("Structured Output (New Way) has been linked.")
            else:
                print(f"❌ Failed to update assistant: {response.status_code}")
                print(response.text)
                    
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"❌ Error during API call: {repr(e)}")

if __name__ == "__main__":
    if not settings.vapi_api_key or not settings.vapi_assistant_backend_id:
        print("❌ Missing API config in .env")
    else:
        asyncio.run(fix_backend_assistant())
