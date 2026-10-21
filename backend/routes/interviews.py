from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime
import secrets
import bcrypt
import string
import os
import shutil
import json
import subprocess

from database import get_db
from models import Interview, InterviewResult
from services.vapi_service import vapi_service, extract_vapi_audio_url, download_and_save_vapi_audio, merge_video_and_audio
from config import get_settings

router = APIRouter(prefix="/api/interviews", tags=["interviews"])
settings = get_settings()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
INTERVIEW_UPLOADS_DIR = os.path.join(UPLOAD_DIR, "interviews")
os.makedirs(INTERVIEW_UPLOADS_DIR, exist_ok=True)


# Request/Response Models
class CreateInterviewRequest(BaseModel):
    candidate_name: str
    candidate_email: EmailStr
    role: str
    category: str = "scholarship"  # 'scholarship' | 'hr'


class InterviewResponse(BaseModel):
    id: int
    candidate_name: str
    candidate_email: str
    role: str
    category: str = "scholarship"
    interview_link: str
    access_password: str | None = None  # Only returned on creation
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class InterviewDetailResponse(InterviewResponse):
    result: dict | None = None
    
    class Config:
        from_attributes = True


@router.post("/create", response_model=InterviewResponse)
async def create_interview(
    request: CreateInterviewRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new interview link for a candidate
    
    HR uses this endpoint to generate interview links
    """
    # Generate unique ID for interview
    unique_id = secrets.token_urlsafe(16)
    
    # Generate random 6-character password
    password_chars = string.ascii_uppercase + string.digits
    access_password = ''.join(secrets.choice(password_chars) for _ in range(6))
    
    # Hash the password
    password_hash = bcrypt.hashpw(access_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    category = request.category or "scholarship"
    if category == "hr":
        assistant_id = settings.vapi_hr_assistant_id or "6389886e-f01e-4d5c-8583-a9bd75fe1a10"
    else:
        assistant_id = settings.vapi_scholarship_assistant_id
    
    # Create web call link
    interview_link = await vapi_service.create_web_call_link(
        assistant_id=assistant_id,
        interview_id=unique_id,
        candidate_name=request.candidate_name
    )
    
    # Create interview record
    interview = Interview(
        candidate_name=request.candidate_name,
        candidate_email=request.candidate_email,
        role=request.role,
        category=category,
        interview_link=interview_link,
        unique_id=unique_id,
        password_hash=password_hash,
        status="pending"
    )
    
    db.add(interview)
    db.commit()
    db.refresh(interview)
    
    # Return interview data with plaintext password (one-time only)
    return InterviewResponse(
        id=interview.id,
        candidate_name=interview.candidate_name,
        candidate_email=interview.candidate_email,
        role=interview.role,
        category=getattr(interview, "category", "scholarship"),
        interview_link=interview.interview_link,
        access_password=access_password,
        status=interview.status,
        created_at=interview.created_at
    )


@router.get("", response_model=list[InterviewDetailResponse])
async def list_interviews(
    role: str | None = None,
    status: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db)
):
    """
    List all interviews with optional filters
    
    HR uses this to view all past and pending interviews
    """
    query = db.query(Interview)
    
    if role:
        query = query.filter(Interview.role == role)
    if status:
        query = query.filter(Interview.status == status)
    if category:
        query = query.filter(Interview.category == category)
    
    interviews = query.order_by(Interview.created_at.desc()).all()
    
    # Build response with results
    response = []
    for interview in interviews:
        interview_dict = {
            "id": interview.id,
            "candidate_name": interview.candidate_name,
            "candidate_email": interview.candidate_email,
            "role": interview.role,
            "category": getattr(interview, "category", "scholarship"),
            "interview_link": interview.interview_link,
            "status": interview.status,
            "created_at": interview.created_at,
            "result": None
        }
        
        if interview.result:
            rec_url = None
            if interview.result.merged_video_path:
                rec_url = f"/{interview.result.merged_video_path.lstrip('/')}"
            elif interview.result.recording_video_filename:
                rec_url = f"/uploads/interviews/{interview.result.recording_video_filename}"
            elif interview.result.recording_video_path:
                rec_url = f"/{interview.result.recording_video_path.lstrip('/')}"
                
            interview_dict["result"] = {
                "transcript": interview.result.transcript,
                "summary": interview.result.summary,
                "evaluation": interview.result.evaluation,
                "call_duration": interview.result.call_duration,
                "completed_at": interview.result.completed_at.isoformat() if interview.result.completed_at else None,
                "recording_url": rec_url,
                "merged_video_url": f"/{interview.result.merged_video_path.lstrip('/')}" if interview.result.merged_video_path else None,
                "audio_url": interview.result.vapi_audio_url,
                "recording_video_filename": interview.result.recording_video_filename,
                "integrity_summary": interview.result.integrity_summary,
                "audio_offset_ms": interview.result.audio_offset_ms
            }
        
        response.append(interview_dict)
    
    return response


@router.get("/{interview_id}", response_model=InterviewDetailResponse)
async def get_interview(
    interview_id: int,
    db: Session = Depends(get_db)
):
    """Get specific interview details"""
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    interview_dict = {
        "id": interview.id,
        "candidate_name": interview.candidate_name,
        "candidate_email": interview.candidate_email,
        "role": interview.role,
        "category": getattr(interview, "category", "scholarship"),
        "interview_link": interview.interview_link,
        "status": interview.status,
        "created_at": interview.created_at,
        "result": None
    }
    
    if interview.result:
        rec_url = None
        if interview.result.merged_video_path:
            rec_url = f"/{interview.result.merged_video_path.lstrip('/')}"
        elif interview.result.recording_video_filename:
            rec_url = f"/uploads/interviews/{interview.result.recording_video_filename}"
        elif interview.result.recording_video_path:
            rec_url = f"/{interview.result.recording_video_path.lstrip('/')}"

        interview_dict["result"] = {
            "transcript": interview.result.transcript,
            "summary": interview.result.summary,
            "evaluation": interview.result.evaluation,
            "call_duration": interview.result.call_duration,
            "completed_at": interview.result.completed_at.isoformat() if interview.result.completed_at else None,
            "recording_url": rec_url,
            "merged_video_url": f"/{interview.result.merged_video_path.lstrip('/')}" if interview.result.merged_video_path else None,
            "audio_url": interview.result.vapi_audio_url,
            "recording_video_filename": interview.result.recording_video_filename,
            "integrity_summary": interview.result.integrity_summary,
            "audio_offset_ms": interview.result.audio_offset_ms
        }
    
    return interview_dict



@router.get("/by-uid/{unique_id}")
async def get_interview_by_uid(
    unique_id: str,
    db: Session = Depends(get_db)
):
    """
    Get interview by unique ID (for candidate page)
    Returns assistant configuration for VAPI Web SDK
    """
    interview = db.query(Interview).filter(Interview.unique_id == unique_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Update status to in_progress if pending
    if interview.status == "pending":
        interview.status = "in_progress"
        db.commit()
    
    category = getattr(interview, "category", "scholarship")
    
    # Route to correct assistant config based on interview category
    if category == "hr":
        assistant_config = await vapi_service.create_hr_assistant_overrides(
            candidate_name=interview.candidate_name,
            role=interview.role
        )
    else:
        assistant_config = await vapi_service.create_assistant_overrides(
            role=interview.role,
            candidate_name=interview.candidate_name
        )
    
    # Inject metadata for the webhook to match the interview
    if "assistantOverrides" not in assistant_config:
        assistant_config["assistantOverrides"] = {}
    
    assistant_config["assistantOverrides"]["metadata"] = {
        "interviewId": interview.unique_id
    }
    
    return {
        "interview": {
            "id": interview.id,
            "candidate_name": interview.candidate_name,
            "role": interview.role,
            "category": category,
            "status": interview.status
        },
        "vapi_config": assistant_config
    }


@router.post("/{interview_id}/complete")
async def manually_complete_interview(
    interview_id: int,
    evaluation_data: dict,
    db: Session = Depends(get_db)
):
    """
    Manually mark interview as completed with evaluation data
    Useful for local testing when webhooks can't reach localhost
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Check if result already exists
    existing_result = db.query(InterviewResult).filter(
        InterviewResult.interview_id == interview.id
    ).first()
    
    if existing_result:
        # Update existing
        existing_result.evaluation = evaluation_data
        existing_result.summary = evaluation_data.get("summary", "")
        existing_result.completed_at = datetime.utcnow()
    else:
        # Create new result
        result = InterviewResult(
            interview_id=interview.id,
            evaluation=evaluation_data,
            summary=evaluation_data.get("summary", ""),
            transcript="",
            call_duration=0,
            completed_at=datetime.utcnow()
        )
        db.add(result)
    
    # Update interview status
    interview.status = "completed"
    interview.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Interview completed successfully"}


@router.delete("/{interview_id}")
async def delete_interview(
    interview_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete an interview and its associated results
    
    HR uses this to remove interviews from the dashboard
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Delete associated results first (if any)
    db.query(InterviewResult).filter(
        InterviewResult.interview_id == interview.id
    ).delete()
    
    # Delete the interview
    db.delete(interview)
    db.commit()
    
    return {"message": "Interview deleted successfully"}


class VerifyPasswordRequest(BaseModel):
    password: str


@router.post("/by-uid/{unique_id}/verify-password")
async def verify_password(
    unique_id: str,
    request: VerifyPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Verify password for interview access
    
    Candidate must provide correct password to access interview
    """
    interview = db.query(Interview).filter(Interview.unique_id == unique_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Check if password hash exists
    if not interview.password_hash:
        # Old interviews without passwords are allowed through
        return {"valid": True}
    
    # Verify password
    is_valid = bcrypt.checkpw(
        request.password.encode('utf-8'),
        interview.password_hash.encode('utf-8')
    )
    
    if not is_valid:
        return {"valid": False, "message": "Invalid password"}
    
    return {
        "valid": True,
        "candidate_name": interview.candidate_name,
        "role": interview.role,
        "category": getattr(interview, "category", "scholarship")
    }


@router.post("/{interview_id}/fetch-results")
async def fetch_results_from_vapi(
    interview_id: int,
    db: Session = Depends(get_db)
):
    """
    Manually fetch interview results from VAPI API
    
    This is a fallback when webhooks don't arrive.
    HR can click a button to pull results directly from VAPI.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Check if we have a result with VAPI call ID
    existing_result = db.query(InterviewResult).filter(
        InterviewResult.interview_id == interview.id
    ).first()
    
    call_id = None
    if existing_result and existing_result.vapi_call_id:
        call_id = existing_result.vapi_call_id
    
    if not call_id:
        # Fallback: Try to find a call on VAPI by unique ID or candidate name
        print(f"🔍 No call_id found in DB. Searching VAPI for UID {interview.unique_id}...")
        matching_calls = await vapi_service.find_calls_by_interview(
            interview_unique_id=interview.unique_id,
            candidate_name=interview.candidate_name
        )
        
        if matching_calls:
            # Use the most recent matching call
            call_id = matching_calls[0].get("id")
            print(f"✨ Found matching call on VAPI: {call_id}")
            
            # Save it so we don't have to search again
            if existing_result:
                existing_result.vapi_call_id = call_id
            else:
                existing_result = InterviewResult(
                    interview_id=interview.id,
                    vapi_call_id=call_id,
                    transcript="",
                    summary="",
                    evaluation=None,
                    call_duration=0
                )
                db.add(existing_result)
            db.commit()
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"No VAPI call found for {interview.candidate_name}. Please ensure the interview has started."
            )
    
    # Fetch from VAPI API
    print(f"🔄 Fetching results from VAPI for call {call_id}")
    call_details = await vapi_service.get_call_details(call_id)
    
    if not call_details:
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch results from VAPI"
        )
    
    # Extract transcript and summary
    artifact = call_details.get("artifact", {})
    analysis = call_details.get("analysis", {})
    summary = analysis.get("summary", "")
    
    # Extract structured outputs
    structured_outputs = artifact.get("structuredOutputs", {})
    
    evaluation_data = None
    for output_id, output_data in structured_outputs.items():
        name = output_data.get("name")
        if name in [
            "Interview_Evaluation", 
            "Backend_Interview_Evaluation", 
            "Scholarship_Evaluation",
            "HR_Screening_Evaluation"
        ]:
            evaluation_data = output_data.get("result")
            # If evaluation has its own summary, use it
            if evaluation_data:
                if evaluation_data.get("interview_summary"):
                    summary = evaluation_data.get("interview_summary")
                elif evaluation_data.get("summary"):
                    summary = evaluation_data.get("summary")
            break
    
    if not evaluation_data:
        # Fallback to analysis structured data
        evaluation_data = analysis.get("structuredData") or analysis.get("evaluation")
    
    if not evaluation_data:
        raise HTTPException(
            status_code=404,
            detail="VAPI has not generated evaluation yet. Please wait 1-2 minutes and try again."
        )
    
    # Extract clean dialogue transcript from messages (exclude internal system prompts and tool messages)
    messages = artifact.get("messages", [])
    if not messages:
        # Try from analysis or call root if missing in artifact
        messages = call_details.get("messages", [])
        
    transcript_parts = []
    for msg in messages:
        role = (msg.get("role") or "").lower()
        # Strictly skip system prompt, instructions, and tool messages
        if role in ["system", "tool", "function"]:
            continue
        content = (msg.get("message") or msg.get("content") or "").strip()
        if not content:
            continue
        speaker = "AI" if role in ["bot", "assistant"] else "CANDIDATE" if role in ["user", "human"] else role.upper()
        transcript_parts.append(f"{speaker}: {content}")
    
    transcript = "\n\n".join(transcript_parts)
    
    # Fallback to call-level transcript if messages was empty
    if not transcript:
        raw_t = call_details.get("transcript", "")
        if raw_t:
            import re
            transcript = re.sub(r"^SYSTEM:[\s\S]*?(?=(?:BOT|ASSISTANT|AI|USER|CANDIDATE):)", "", raw_t, flags=re.IGNORECASE).strip()
    
    # Download VAPI stereo audio recording server-side and save locally
    vapi_audio_path = await download_and_save_vapi_audio(call_id, interview.id, call_details)
    
    # Update database
    if existing_result:
        existing_result.evaluation = evaluation_data
        existing_result.summary = summary
        existing_result.transcript = transcript
        if vapi_audio_path:
            existing_result.vapi_audio_url = vapi_audio_path
        existing_result.completed_at = datetime.utcnow()
    else:
        result = InterviewResult(
            interview_id=interview.id,
            vapi_call_id=call_id,
            transcript=transcript,
            summary=summary,
            evaluation=evaluation_data,
            vapi_audio_url=vapi_audio_path,
            call_duration=call_details.get("duration", 0),
            completed_at=datetime.utcnow()
        )
        db.add(result)
    
    # Update interview status
    interview.status = "completed"
    interview.updated_at = datetime.utcnow()
    
    db.commit()
    
    print(f"✅ Results fetched and saved for interview {interview.id}")
    
    return {
        "message": "Results fetched successfully",
        "evaluation": evaluation_data
    }


@router.post("/{interview_id}/fetch-audio")
async def fetch_audio_from_vapi(
    interview_id: int,
    db: Session = Depends(get_db)
):
    """
    Manually fetch and download VAPI stereo audio recording for an interview.
    Saves file to backend/uploads/audio/ and updates database with local relative path.
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    result = db.query(InterviewResult).filter(InterviewResult.interview_id == interview.id).first()
    call_id = result.vapi_call_id if result else None
    
    if not call_id:
        matching_calls = await vapi_service.find_calls_by_interview(
            interview_unique_id=interview.unique_id,
            candidate_name=interview.candidate_name
        )
        if matching_calls:
            call_id = matching_calls[0].get("id")
            if result:
                result.vapi_call_id = call_id
            else:
                result = InterviewResult(interview_id=interview.id, vapi_call_id=call_id)
                db.add(result)
            db.commit()
            
    if not call_id:
        raise HTTPException(status_code=400, detail="No VAPI call ID found for this interview.")
        
    call_details = await vapi_service.get_call_details(call_id)
    audio_path = await download_and_save_vapi_audio(call_id, interview.id, call_details)
    
    if not audio_path:
        raise HTTPException(status_code=500, detail="Failed to download VAPI stereo audio recording.")
        
    if not result:
        result = InterviewResult(interview_id=interview.id, vapi_call_id=call_id)
        db.add(result)
        
    result.vapi_audio_url = audio_path
    db.commit()
    
    # Automatically merge webcam video + VAPI audio if both are ready
    merged_path = merge_video_and_audio(interview.id, db)
    
    return {
        "message": "Audio fetched and downloaded successfully",
        "audio_url": f"/{audio_path.lstrip('/')}",
        "video_url": f"/{merged_path.lstrip('/')}" if merged_path else None
    }


@router.post("/{interview_id}/recording")
async def upload_recording(
    interview_id: int,
    file: UploadFile = File(...),
    integrity_data: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload webcam video recording and integrity metadata for an interview
    Saves actual video file locally under backend/uploads/interviews/
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    # Generate unique filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"interview_{interview.id}_{timestamp}_{interview.unique_id[:8]}.webm"
    file_path = os.path.join(INTERVIEW_UPLOADS_DIR, filename)
    
    # Save video binary file locally
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    relative_path = f"uploads/interviews/{filename}"
    
    # Parse integrity metadata JSON
    parsed_integrity = None
    if integrity_data:
        try:
            parsed_integrity = json.loads(integrity_data)
        except Exception as e:
            print(f"⚠️ Failed to parse integrity JSON: {e}")
            parsed_integrity = {"raw": integrity_data}
            
    # Update database record
    existing_result = db.query(InterviewResult).filter(
        InterviewResult.interview_id == interview.id
    ).first()
    
    if existing_result:
        existing_result.recording_video_path = relative_path
        existing_result.recording_video_filename = filename
        existing_result.recording_uploaded_at = datetime.utcnow()
        if parsed_integrity and isinstance(parsed_integrity, dict):
            existing_result.integrity_summary = parsed_integrity
            if "audio_offset_ms" in parsed_integrity:
                existing_result.audio_offset_ms = parsed_integrity.get("audio_offset_ms")
            if "video_recording_started_at_ms" in parsed_integrity:
                existing_result.video_started_at_ms = parsed_integrity.get("video_recording_started_at_ms")
            if "vapi_call_started_at_ms" in parsed_integrity:
                existing_result.vapi_started_at_ms = parsed_integrity.get("vapi_call_started_at_ms")
    else:
        audio_offset_ms = parsed_integrity.get("audio_offset_ms") if isinstance(parsed_integrity, dict) else None
        video_started_at_ms = parsed_integrity.get("video_recording_started_at_ms") if isinstance(parsed_integrity, dict) else None
        vapi_started_at_ms = parsed_integrity.get("vapi_call_started_at_ms") if isinstance(parsed_integrity, dict) else None

        existing_result = InterviewResult(
            interview_id=interview.id,
            recording_video_path=relative_path,
            recording_video_filename=filename,
            recording_uploaded_at=datetime.utcnow(),
            integrity_summary=parsed_integrity,
            audio_offset_ms=audio_offset_ms,
            video_started_at_ms=video_started_at_ms,
            vapi_started_at_ms=vapi_started_at_ms,
            transcript="",
            summary="",
            completed_at=datetime.utcnow()
        )
        db.add(existing_result)
        
    db.commit()
    print(f"🎬 Video recording saved for interview {interview.id}: {file_path}")
    
    # Check if this is a combined A/V recording (screen_pip_av or combined_av: audio already embedded in video)
    is_combined_av = (
        isinstance(parsed_integrity, dict) and (
            parsed_integrity.get("recording_type") in ["screen_pip_av", "combined_av"] or
            parsed_integrity.get("screen_recording_enabled") is True
        )
    )
    
    if is_combined_av:
        # Full A/V recording: both candidate and interviewer audio are already mixed into the video.
        # Transcode directly to MP4 with matched video + AAC audio duration for perfect browser playback.
        final_path = relative_path
        try:
            import imageio_ffmpeg
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            dir_name = os.path.dirname(file_path)
            base_name = os.path.splitext(filename)[0]
            mp4_filename = f"{base_name}_final.mp4"
            mp4_path = os.path.join(dir_name, mp4_filename)
            mp4_rel = f"uploads/interviews/{mp4_filename}"

            cmd = [
                ffmpeg_exe, "-y",
                "-fflags", "+genpts",
                "-i", file_path,
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "24",
                "-c:a", "aac",
                "-movflags", "+faststart",
                mp4_path
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode == 0 and os.path.exists(mp4_path) and os.path.getsize(mp4_path) > 0:
                print(f"✅ Generated full-length synchronized MP4 ({os.path.getsize(mp4_path)} bytes) -> {mp4_rel}")
                final_path = mp4_rel
        except Exception as e:
            print(f"⚠️ Direct MP4 transcode fallback: {e}")

        existing_result.merged_video_path = final_path
        db.commit()
        print(f"✅ Full A/V recording saved. Path: {final_path}")
    else:
        # Legacy: video-only recording, try to merge with VAPI audio via FFmpeg
        merged_path = merge_video_and_audio(interview.id, db)
        final_path = merged_path or relative_path
    
    return {
        "message": "Recording uploaded successfully",
        "video_url": f"{settings.backend_url}/{final_path}",
        "filename": filename,
        "combined_av": is_combined_av
    }

