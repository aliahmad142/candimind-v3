"""
Manual script to fetch VAPI results and update database
Use this when webhooks aren't working
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import SessionLocal, init_db
from models import Interview, InterviewResult
from services.vapi_service import vapi_service
from datetime import datetime


async def fetch_and_save_results(interview_id: int, vapi_call_id: str):
    """
    Manually fetch results from VAPI and save to database
    
    Args:
        interview_id: The database interview ID
        vapi_call_id: The VAPI call ID from their dashboard
    """
    db = SessionLocal()
    
    try:
        # Get interview
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        
        if not interview:
            print(f"❌ Interview {interview_id} not found")
            return
        
        print(f"📋 Interview found: {interview.candidate_name} ({interview.role})")
        print(f"🔄 Fetching results from VAPI for call: {vapi_call_id}")
        
        # Fetch from VAPI
        call_details = await vapi_service.get_call_details(vapi_call_id)
        
        if not call_details:
            print("❌ Failed to fetch from VAPI")
            return
        
        print("✅ Call details retrieved from VAPI")
        
        # Extract structured outputs
        artifact = call_details.get("artifact", {})
        structured_outputs = artifact.get("structuredOutputs", {})
        
        evaluation_data = None
        for output_id, output_data in structured_outputs.items():
            name = output_data.get("name")
            if name in ["Interview_Evaluation", "Backend_Interview_Evaluation"]:
                evaluation_data = output_data.get("result")
                break
        
        if not evaluation_data:
            print("⚠️  No evaluation data found yet. VAPI might still be processing.")
            print("    Try again in 1-2 minutes.")
            return
        
        # Extract transcript
        messages = artifact.get("messages", [])
        transcript_parts = []
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("message") or msg.get("content", "")
            transcript_parts.append(f"{role.upper()}: {content}")
        
        transcript = "\n\n".join(transcript_parts)
        
        # Check if result exists
        existing_result = db.query(InterviewResult).filter(
            InterviewResult.interview_id == interview.id
        ).first()
        
        if existing_result:
            # Update existing
            existing_result.vapi_call_id = vapi_call_id
            existing_result.transcript = transcript
            existing_result.summary = evaluation_data.get("summary", "")
            existing_result.evaluation = evaluation_data
            existing_result.call_duration = call_details.get("duration", 0)
            existing_result.completed_at = datetime.utcnow()
            print("📝 Updated existing result")
        else:
            # Create new
            result = InterviewResult(
                interview_id=interview.id,
                vapi_call_id=vapi_call_id,
                transcript=transcript,
                summary=evaluation_data.get("summary", ""),
                evaluation=evaluation_data,
                call_duration=call_details.get("duration", 0),
                completed_at=datetime.utcnow()
            )
            db.add(result)
            print("✨ Created new result")
        
        # Update interview status
        interview.status = "completed"
        interview.updated_at = datetime.utcnow()
        
        db.commit()
        
        print("✅ Results saved successfully!")
        print(f"   Summary: {evaluation_data.get('summary', 'N/A')[:100]}...")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("🔧 Manual VAPI Results Fetcher")
    print("=" * 50)
    
    if len(sys.argv) < 3:
        print("\nUsage:")
        print("  python manual_fetch_results.py <interview_id> <vapi_call_id>")
        print("\nExample:")
        print("  python manual_fetch_results.py 2 abc123-def456-ghi789")
        print("\nTo find these values:")
        print("  1. Interview ID: Check your HR Dashboard URL or database")
        print("  2. VAPI Call ID: Go to VAPI Dashboard → Calls → Click on call → Copy ID")
        sys.exit(1)
    
    interview_id = int(sys.argv[1])
    vapi_call_id = sys.argv[2]
    
    print(f"\n📌 Interview ID: {interview_id}")
    print(f"📌 VAPI Call ID: {vapi_call_id}\n")
    
    # Initialize database
    init_db()
    
    # Run async function
    asyncio.run(fetch_and_save_results(interview_id, vapi_call_id))
