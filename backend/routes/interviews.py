from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime
import secrets
import bcrypt
import string

from database import get_db
from models import Interview, InterviewResult
from services.vapi_service import vapi_service
from config import get_settings

router = APIRouter(prefix="/api/interviews", tags=["interviews"])
settings = get_settings()


# Request/Response Models
class CreateInterviewRequest(BaseModel):
    candidate_name: str
    candidate_email: EmailStr
    role: Literal["frontend", "backend"]


class InterviewResponse(BaseModel):
    id: int
    candidate_name: str
    candidate_email: str
    role: str
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
    
    # Get assistant ID for the role
    assistant_id = vapi_service.get_assistant_id_for_role(request.role)
    
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
        interview_link=interview.interview_link,
        access_password=access_password,
        status=interview.status,
        created_at=interview.created_at
    )


@router.get("", response_model=list[InterviewDetailResponse])
async def list_interviews(
    role: str | None = None,
    status: str | None = None,
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
    
    interviews = query.order_by(Interview.created_at.desc()).all()
    
    # Build response with results
    response = []
    for interview in interviews:
        interview_dict = {
            "id": interview.id,
            "candidate_name": interview.candidate_name,
            "candidate_email": interview.candidate_email,
            "role": interview.role,
            "interview_link": interview.interview_link,
            "status": interview.status,
            "created_at": interview.created_at,
            "result": None
        }
        
        if interview.result:
            interview_dict["result"] = {
                "transcript": interview.result.transcript,
                "summary": interview.result.summary,
                "evaluation": interview.result.evaluation,
                "call_duration": interview.result.call_duration,
                "completed_at": interview.result.completed_at.isoformat() if interview.result.completed_at else None
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
        "interview_link": interview.interview_link,
        "status": interview.status,
        "created_at": interview.created_at,
        "result": None
    }
    
    if interview.result:
        interview_dict["result"] = {
            "transcript": interview.result.transcript,
            "summary": interview.result.summary,
            "evaluation": interview.result.evaluation,
            "call_duration": interview.result.call_duration,
            "completed_at": interview.result.completed_at.isoformat() if interview.result.completed_at else None
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
    
    # Get assistant config with personalization
    assistant_config = await vapi_service.create_assistant_overrides(
        role=interview.role,
        candidate_name=interview.candidate_name
    )
    
    return {
        "interview": {
            "id": interview.id,
            "candidate_name": interview.candidate_name,
            "role": interview.role,
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
    
    return {"valid": True}


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
        raise HTTPException(
            status_code=400, 
            detail="No VAPI call ID found. Interview may not have started yet."
        )
    
    # Fetch from VAPI API
    print(f"🔄 Fetching results from VAPI for call {call_id}")
    call_details = await vapi_service.get_call_details(call_id)
    
    if not call_details:
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch results from VAPI"
        )
    
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
        raise HTTPException(
            status_code=404,
            detail="VAPI has not generated evaluation yet. Please wait 1-2 minutes and try again."
        )
    
    # Extract transcript
    messages = artifact.get("messages", [])
    transcript_parts = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("message") or msg.get("content", "")
        transcript_parts.append(f"{role.upper()}: {content}")
    
    transcript = "\n\n".join(transcript_parts)
    
    # Update database
    if existing_result:
        existing_result.evaluation = evaluation_data
        existing_result.summary = evaluation_data.get("summary", "")
        existing_result.transcript = transcript
        existing_result.completed_at = datetime.utcnow()
    else:
        result = InterviewResult(
            interview_id=interview.id,
            vapi_call_id=call_id,
            transcript=transcript,
            summary=evaluation_data.get("summary", ""),
            evaluation=evaluation_data,
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

