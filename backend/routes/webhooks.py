from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json

from database import get_db
from models import Interview, InterviewResult
from services.vapi_service import extract_vapi_audio_url, download_and_save_vapi_audio, merge_video_and_audio

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/vapi")
async def vapi_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Webhook endpoint to receive interview data from VAPI
    
    VAPI calls this endpoint when an interview ends with:
    - Call transcript
    - AI-generated summary
    - Call metadata
    """
    try:
        payload = await request.json()
        
        # DEBUG: Write to file for troubleshooting
        import os
        debug_file = os.path.join(os.path.dirname(__file__), "..", "webhook_debug.log")
        with open(debug_file, "a") as f:
            f.write(f"\n{'='*80}\n")
            f.write(f"WEBHOOK RECEIVED AT: {datetime.utcnow()}\n")
            f.write(f"Event Type: {payload.get('type') or payload.get('event')}\n")
            f.write(f"Full Payload:\n{json.dumps(payload, indent=2)}\n")
            f.write(f"{'='*80}\n")
        
        # Enhanced logging for debugging
        print("\n" + "="*80)
        print("📞 VAPI WEBHOOK RECEIVED!")
        print("="*80)
        print(f"Event Type: {payload.get('type') or payload.get('event')}")
        print(f"Full Payload: {json.dumps(payload, indent=2)}")
        print("="*80 + "\n")
        
        # Extract event type from VAPI's nested structure
        # VAPI sends: {"message": {"type": "end-of-call-report", ...}}
        event_type = None
        if "message" in payload:
            event_type = payload["message"].get("type")
        if not event_type:
            event_type = payload.get("type") or payload.get("event")
        
        # Handle assistant-request (sent at the very start of the call)
        if event_type == "assistant-request":
            print(f"👋 Processing assistant-request webhook")
            await handle_status_update(payload, db)
            
        # Handle end-of-call event
        elif event_type == "end-of-call-report" or event_type == "call.ended":
            print(f"✅ Processing end-of-call-report webhook")
            await handle_end_of_call(payload, db)
        
        # Handle status updates
        elif event_type == "status-update" or event_type == "call.started":
            print(f"📍 Processing status-update webhook")
            await handle_status_update(payload, db)
        
        else:
            print(f"⚠️  Unknown event type: {event_type}")
        
        return {"status": "success", "message": "Webhook processed"}
    
    except Exception as e:
        print(f"❌ Webhook error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def handle_end_of_call(payload: dict, db: Session):
    """Process end-of-call webhook from VAPI"""
    
    print("\n" + "="*80)
    print("🎯 PROCESSING END-OF-CALL WEBHOOK")
    print("="*80)
    
    # VAPI sends data nested in payload.message
    # Extract the actual message data
    message_data = payload.get("message", {})
    
    print(f"🔍 Payload top-level keys: {list(payload.keys())}")
    print(f"🔍 Message data keys: {list(message_data.keys())}")
    
    # Extract data from VAPI payload
    # All call data is in message_data, not in top-level payload
    call_id = None
    if "call" in message_data and isinstance(message_data["call"], dict):
        call_id = message_data["call"].get("id")
    if not call_id:
        call_id = message_data.get("callId")
    if not call_id:
        call_id = message_data.get("id")
        
    print(f"📞 Call ID: {call_id}")
    
    # Extract metadata to find interview ID
    metadata = message_data.get("call", {}).get("metadata") or message_data.get("metadata", {})
    interview_unique_id = metadata.get("interviewId")
    
    print(f"📋 Metadata: {metadata}")
    print(f"🔑 Interview Unique ID from metadata: {interview_unique_id}")
    
    # Extract transcript and analysis from message_data
    messages = message_data.get("call", {}).get("messages") or message_data.get("messages", [])
    analysis = message_data.get("call", {}).get("analysis") or message_data.get("analysis", {})
    
    # Build clean dialogue transcript from messages (exclude internal system prompts and tool messages)
    transcript_parts = []
    for msg in messages:
        role = (msg.get("role") or "").lower()
        # Strictly skip system prompt, system instructions, and tool messages
        if role in ["system", "tool", "function"]:
            continue
        content = (msg.get("content") or msg.get("message") or "").strip()
        if not content:
            continue
        speaker = "AI" if role in ["bot", "assistant"] else "CANDIDATE" if role in ["user", "human"] else role.upper()
        transcript_parts.append(f"{speaker}: {content}")
    
    transcript = "\n\n".join(transcript_parts)
    
    # Fallback to call transcript if messages didn't yield dialogue
    if not transcript:
        raw_vapi_transcript = message_data.get("call", {}).get("transcript") or message_data.get("transcript", "")
        if raw_vapi_transcript:
            import re
            transcript = re.sub(r"^SYSTEM:[\s\S]*?(?=(?:BOT|ASSISTANT|AI|USER|CANDIDATE):)", "", raw_vapi_transcript, flags=re.IGNORECASE).strip()
    
    # Extract summary and structured data from VAPI's actual webhook structure
    summary = analysis.get("summary", "")
    
    # VAPI sends structured outputs in: message_data.artifact.structuredOutputs
    artifact = message_data.get("artifact", {})
    structured_outputs = artifact.get("structuredOutputs", {})
    evaluation_data = None
    
    print(f"📊 Structured Outputs found: {len(structured_outputs)} items")
    
    if structured_outputs:
        # Get the structured output matching the interview type
        for output_id, output_data in structured_outputs.items():
            out_name = output_data.get("name")
            if out_name in [
                "Interview_Evaluation", 
                "Backend_Interview_Evaluation", 
                "Scholarship_Evaluation",
                "HR_Screening_Evaluation"
            ]:
                evaluation_data = output_data.get("result")
                print(f"✅ Found {out_name} structured output!")
                if evaluation_data:
                    # Support both HR summary (interview_summary) and academic summary (summary)
                    if evaluation_data.get("interview_summary"):
                        summary = evaluation_data.get("interview_summary")
                    elif evaluation_data.get("summary"):
                        summary = evaluation_data.get("summary")
                    
                    if "overall_score" in evaluation_data:
                        print(f"   - Overall Score: {evaluation_data.get('overall_score')}")
                    if "review_status" in evaluation_data:
                        print(f"   - Review Status: {evaluation_data.get('review_status')}")
                break
    
    # Fallback to old location if not found in structuredOutputs
    if not evaluation_data:
        evaluation_data = analysis.get("structuredData") or analysis.get("evaluation")
        print(f"⚠️  Using fallback evaluation data location")
    
    # Get call duration
    duration = message_data.get("call", {}).get("duration") or message_data.get("duration", 0)
    
    # Find interview by metadata
    interview = None
    if interview_unique_id:
        interview = db.query(Interview).filter(
            Interview.unique_id == interview_unique_id
        ).first()
        if interview:
            print(f"✅ Found interview by unique_id: {interview.id} - {interview.candidate_name}")
        else:
            print(f"⚠️  No interview found with unique_id: {interview_unique_id}")
    
    # If not found by metadata, try to match by call timing (fallback)
    if not interview:
        print(f"🔍 Trying fallback: finding most recent in_progress interview...")
        # Get most recent in_progress interview
        interview = db.query(Interview).filter(
            Interview.status == "in_progress"
        ).order_by(Interview.updated_at.desc()).first()
        
        if interview:
            print(f"✅ Found interview by fallback: {interview.id} - {interview.candidate_name}")
    
    if not interview:
        print(f"⚠️  No interview found for call {call_id}")
        return
    
    # Download VAPI stereo audio recording server-side and save locally
    vapi_audio_path = await download_and_save_vapi_audio(call_id, interview.id, payload)
    if not vapi_audio_path and message_data:
        vapi_audio_path = await download_and_save_vapi_audio(call_id, interview.id, message_data)
        
    print(f"🎵 VAPI Local Audio Recording Path: {vapi_audio_path}")

    # Check if result already exists
    existing_result = db.query(InterviewResult).filter(
        InterviewResult.interview_id == interview.id
    ).first()
    
    if existing_result:
        # Update existing result
        existing_result.vapi_call_id = call_id
        existing_result.transcript = transcript
        existing_result.summary = summary
        existing_result.evaluation = evaluation_data
        existing_result.call_duration = duration
        if vapi_audio_path:
            existing_result.vapi_audio_url = vapi_audio_path
        existing_result.raw_webhook_data = message_data  # Save the actual message data
        existing_result.completed_at = datetime.utcnow()
    else:
        # Create new result
        result = InterviewResult(
            interview_id=interview.id,
            vapi_call_id=call_id,
            transcript=transcript,
            summary=summary,
            evaluation=evaluation_data,
            call_duration=duration,
            vapi_audio_url=vapi_audio_path,
            raw_webhook_data=message_data,  # Save the actual message data
            completed_at=datetime.utcnow()
        )
        db.add(result)
    
    # Update interview status
    interview.status = "completed"
    interview.updated_at = datetime.utcnow()
    
    print(f"📝 Committing to database...")
    db.commit()
    
    # Automatically merge webcam video + VAPI audio if both are ready
    merge_video_and_audio(interview.id, db)
    
    print(f"✅ Interview {interview.id} ({interview.candidate_name}) completed and saved!")
    print(f"   - Status: {interview.status}")
    print(f"   - Evaluation data saved: {evaluation_data is not None}")
    
    # If no evaluation data yet, poll VAPI API for structured outputs
    # This runs even without call_id by finding the most recent interview call
    if not evaluation_data:
        print(f"⏳ No evaluation data in webhook. Will poll VAPI API for structured outputs...")
        
        # If we don't have call_id from webhook, try to find it from the interview
        if not call_id:
            print(f"⚠️  No call_id in webhook payload. Skipping VAPI polling.")
            print(f"   You can manually trigger result fetch later.")
        else:
            # Import here to avoid circular dependency
            from services.vapi_service import vapi_service
            import asyncio
            
            # Poll VAPI API with retries (structured outputs take 1-2 minutes to process)
            max_attempts = 6
            wait_seconds = 20
            
            for attempt in range(1, max_attempts + 1):
                print(f"   Attempt {attempt}/{max_attempts}: Waiting {wait_seconds}s before polling...")
                await asyncio.sleep(wait_seconds)
                
                print(f"   Fetching call details from VAPI API...")
                call_details = await vapi_service.get_call_details(call_id)
                
                # Check for audio recording URL in polled call details
                polled_audio_url = extract_vapi_audio_url(call_details)
                if polled_audio_url:
                    res = db.query(InterviewResult).filter(InterviewResult.interview_id == interview.id).first()
                    if res and not res.vapi_audio_url:
                        res.vapi_audio_url = polled_audio_url
                        db.commit()
                        print(f"   🎵 Updated vapi_audio_url from polling: {polled_audio_url}")
                
                # Check if structured outputs are available
                structured_outputs = call_details.get("artifact", {}).get("structuredOutputs", {})
                
                if structured_outputs:
                    print(f"   ✅ Structured outputs found! Updating interview...")
                    
                    # Extract evaluation from structured outputs
                    for output_id, output_data in structured_outputs.items():
                        name = output_data.get("name")
                        if name in [
                            "Interview_Evaluation", 
                            "Backend_Interview_Evaluation", 
                            "Scholarship_Evaluation",
                            "HR_Screening_Evaluation"
                        ]:
                            new_evaluation_data = output_data.get("result")
                            
                            if new_evaluation_data:
                                # Update the interview result with evaluation data
                                result = db.query(InterviewResult).filter(
                                    InterviewResult.interview_id == interview.id
                                ).first()
                                
                                if result:
                                    result.evaluation = new_evaluation_data
                                    if new_evaluation_data.get("interview_summary"):
                                        result.summary = new_evaluation_data.get("interview_summary")
                                    elif new_evaluation_data.get("summary"):
                                        result.summary = new_evaluation_data.get("summary")
                                    db.commit()
                                    
                                    print(f"   ✅ Evaluation data updated for {name}!")
                                    if "overall_score" in new_evaluation_data:
                                        print(f"      - Overall Score: {new_evaluation_data.get('overall_score')}")
                                    if "review_status" in new_evaluation_data:
                                        print(f"      - Review Status: {new_evaluation_data.get('review_status')}")
                                    break
                    break  # Exit retry loop
                else:
                    print(f"   ⏳ Structured outputs not ready yet...")
    
    
    print("="*80 + "\n")


async def handle_status_update(payload: dict, db: Session):
    """Handle call status updates from VAPI"""
    
    # 1. Extract message data if nested
    message_data = payload.get("message", {}) if "message" in payload else payload
    
    # 2. Extract interview ID from metadata or overrides
    # Check all possible locations for interviewId
    metadata = message_data.get("call", {}).get("metadata") or message_data.get("metadata", {})
    overrides = message_data.get("assistantOverrides", {}) or payload.get("assistantOverrides", {})
    overrides_metadata = overrides.get("metadata", {})
    
    interview_unique_id = (
        metadata.get("interviewId") or 
        overrides_metadata.get("interviewId") or 
        payload.get("metadata", {}).get("interviewId")
    )
    
    print(f"🔍 Webhook Search: interviewId={interview_unique_id}")
    
    if not interview_unique_id:
        return
    
    interview = db.query(Interview).filter(
        Interview.unique_id == interview_unique_id
    ).first()
    
    if interview:
        # Update status to in_progress if not already completed
        if interview.status != "completed":
            interview.status = "in_progress"
            interview.updated_at = datetime.utcnow()
        
        # Extract call ID from webhook payload
        # Try multiple locations to be safe
        call_id = None
        
        # 1. Check inside "message" (nested format)
        message_data = payload.get("message", {})
        if "call" in message_data and isinstance(message_data["call"], dict):
            call_id = message_data["call"].get("id")
        if not call_id:
            call_id = message_data.get("callId") or message_data.get("id")
            
        # 2. Check at root (flat format)
        if not call_id:
            if "call" in payload and isinstance(payload["call"], dict):
                call_id = payload["call"].get("id")
        if not call_id:
            call_id = payload.get("callId") or payload.get("id")
        
        # Create InterviewResult record with call_id for later fetching
        # This allows manual "Fetch Results" to work
        if call_id:
            existing_result = db.query(InterviewResult).filter(
                InterviewResult.interview_id == interview.id
            ).first()
            
            if not existing_result:
                result = InterviewResult(
                    interview_id=interview.id,
                    vapi_call_id=call_id,
                    transcript="",
                    summary="",
                    evaluation=None,
                    call_duration=0
                )
                db.add(result)
                print(f"💾 Saved call_id {call_id} for interview {interview.id}")
            else:
                 # Update existing result if it doesn't have call_id
                 if not existing_result.vapi_call_id:
                     existing_result.vapi_call_id = call_id
                     print(f"💾 Updated call_id {call_id} for interview {interview.id}")
        
        db.commit()
        print(f"📍 Interview {interview.id} started")
