import httpx
from typing import Literal
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
    
    def get_assistant_id_for_role(self, role: Literal["frontend", "backend"]) -> str:
        """Get the appropriate VAPI assistant ID based on role"""
        if role == "frontend":
            return settings.vapi_assistant_frontend_id
        elif role == "backend":
            return settings.vapi_assistant_backend_id
        else:
            raise ValueError(f"Invalid role: {role}")
    
    async def get_assistant_config(self, role: Literal["frontend", "backend"]) -> dict:
        """
        Get assistant configuration for embedding in frontend
        This returns the config needed for VAPI Web SDK
        """
        assistant_id = self.get_assistant_id_for_role(role)
        
        # Return configuration for VAPI Web SDK
        return {
            "assistantId": assistant_id,
            "apiKey": self.api_key,  # Public key if using client-side, or handle server-side
        }
    
    async def create_assistant_overrides(
        self,
        role: Literal["frontend", "backend"],
        candidate_name: str
    ) -> dict:
        """
        Create assistant configuration overrides for personalization
        This can customize the assistant behavior per candidate
        """
        base_assistant_id = self.get_assistant_id_for_role(role)
        
        # You can override the first message to personalize it
        role_title = "Frontend React Native Developer" if role == "frontend" else "Backend Developer (TypeScript)"
        
        first_message = (
            f"Hello {candidate_name}, and welcome. I'm your interviewer for the "
            f"Senior Specialist – {role_title} role. This interview will focus on your "
            f"{'mobile development experience with React Native' if role == 'frontend' else 'backend engineering experience with TypeScript and Node.js'}, "
            f"how you build production-ready {'mobile applications' if role == 'frontend' else 'APIs and systems'}, "
            f"and how you handle real-world challenges. This session may be recorded for review. "
            f"If you're in a quiet place and ready to begin, please say 'yes.'"
        )
        
        return {
            "assistantId": base_assistant_id,
            "assistantOverrides": {
                "firstMessage": first_message,
                "variableValues": {
                    "candidateName": candidate_name
                }
            }
        }
    
    async def get_call_details(self, call_id: str) -> dict:
        """
        Fetch call details from VAPI API including structured outputs
        
        Args:
            call_id: The VAPI call ID
            
        Returns:
            Call details including structured outputs if available
        """
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


# Singleton instance
vapi_service = VAPIService()
