import httpx
from config import get_settings

settings = get_settings()


class VAPIService:
    """Service for interacting with VAPI API"""
    
    BASE_URL = "https://api.vapi.ai"
    
    def __init__(self):
        self.api_key = settings.vapi_api_key
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def create_web_call_link(
        self,
        assistant_id: str,
        interview_id: str,
        candidate_name: str,
        metadata: dict = None
    ) -> str:
        """
        Create a web call link for VAPI interview
        
        Args:
            assistant_id: VAPI assistant ID
            interview_id: Our internal interview ID
            candidate_name: Candidate's name
            metadata: Additional metadata to pass to VAPI
        
        Returns:
            Web call URL for the candidate
        """
        # Construct the web call URL with assistant
        # VAPI Web SDK will use this assistant ID
        web_url = f"{settings.frontend_url}/interview/{interview_id}"
        
        return web_url
    
    def _get_prompt(self, filename: str) -> str:
        """Helper to read prompt from file"""
        import os
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "..", "vapi-prompts", filename)
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            print(f"❌ Error reading prompt file {filename}: {e}")
            return ""

    async def create_assistant_overrides(
        self,
        role: str,  # Now a scholarship program name
        candidate_name: str
    ) -> dict:
        """
        Create assistant configuration overrides for scholarship interviews
        """
        base_assistant_id = settings.vapi_scholarship_assistant_id

        # Use the master scholarship prompt
        system_prompt = self._get_prompt("scholarship-academic-prompt.md")
        
        # Simple template replacement
        system_prompt = system_prompt.replace("{{candidateName}}", candidate_name)
        system_prompt = system_prompt.replace("{{role}}", role)

        # Soft and friendly first message
        first_message = f"Hi {candidate_name}! It's great to meet you. I'm part of the Selection Committee for the {role} program. How are you doing today?"
        
        return {
            "assistantId": base_assistant_id,
            "assistantOverrides": {
                "firstMessage": first_message,
                "serverUrl": f"{settings.backend_url}/api/webhooks/vapi",
                "model": {
                    "provider": "openai",
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "system",
                            "content": system_prompt
                        }
                    ]
                },
                "variableValues": {
                    "candidateName": candidate_name,
                    "scholarshipProgram": role
                },
                "silenceTimeoutSeconds": 60,
                "maxDurationSeconds": 1800,  # 30 minutes
            }
        }
    
    async def get_call_details(self, call_id: str) -> dict:
        """Fetch call details from VAPI API"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/call/{call_id}",
                headers=self.headers,
                timeout=30.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ Failed to fetch call details: {response.status_code}")
                return {}

    async def find_calls_by_interview(self, interview_unique_id: str, candidate_name: str = None, limit: int = 50) -> list:
        """
        Search for recent calls matching an interview ID or candidate name
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/call?limit={limit}",
                headers=self.headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                return []
                
            calls = response.json()
            matching_calls = []
            
            for call in calls:
                # 1. Check metadata (most reliable)
                overrides = call.get("assistantOverrides", {}) or {}
                metadata = overrides.get("metadata", {}) or call.get("metadata", {}) or {}
                
                if metadata.get("interviewId") == interview_unique_id:
                    matching_calls.append(call)
                    continue
                
                # 2. Check variableValues (fallback if individual call is fetched, 
                # but might be missing in list response)
                variables = call.get("variableValues", {}) or {}
                if candidate_name and variables.get("candidateName") == candidate_name:
                    matching_calls.append(call)
                    continue
                
                # 3. Check customer name
                customer = call.get("customer", {}) or {}
                if candidate_name and customer.get("name") == candidate_name:
                    matching_calls.append(call)
                    continue
                    
            return matching_calls


# Singleton instance
vapi_service = VAPIService()
