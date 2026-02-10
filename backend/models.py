from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Interview(Base):
    """Interview model - stores interview link and candidate info"""
    __tablename__ = "interviews"
    
    id = Column(Integer, primary_key=True, index=True)
    candidate_name = Column(String(255), nullable=False)
    candidate_email = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # 'frontend' or 'backend'
    interview_link = Column(String(500), nullable=False, unique=True)
    unique_id = Column(String(100), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)  # Hashed password for interview access
    status = Column(String(50), default="pending")  # pending, in_progress, completed, expired
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    result = relationship("InterviewResult", back_populates="interview", uselist=False)
    
    def __repr__(self):
        return f"<Interview {self.candidate_name} - {self.role}>"


class InterviewResult(Base):
    """Interview result model - stores feedback and summary from VAPI"""
    __tablename__ = "interview_results"
    
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False, unique=True)
    
    # VAPI call data
    vapi_call_id = Column(String(255), nullable=True)
    call_duration = Column(Float, nullable=True)  # Duration in seconds
    
    # Interview content
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    evaluation = Column(JSON, nullable=True)  # Structured evaluation from AI
    
    # Metadata
    completed_at = Column(DateTime, default=datetime.utcnow)
    raw_webhook_data = Column(JSON, nullable=True)  # Store complete webhook payload
    
    # Relationship
    interview = relationship("Interview", back_populates="result")
    
    def __repr__(self):
        return f"<InterviewResult for Interview {self.interview_id}>"
