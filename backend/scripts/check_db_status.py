import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Interview, InterviewResult
import json

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def check_db():
    try:
        db = SessionLocal()
        print("Checking Database Status...")
        
        interviews = db.query(Interview).all()
        print(f"\nTotal Interviews: {len(interviews)}")
        
        target_interview = None
        
        for i in interviews:
            # Check for result
            res = db.query(InterviewResult).filter(InterviewResult.interview_id == i.id).first()
            call_id = res.vapi_call_id if res else "None"
            
            print(f"ID: {i.id} | Candidate: {i.candidate_name} | Role: {i.role} | Status: {i.status} | CallID: {call_id}")
            if "ali" in i.candidate_name.lower():
                target_interview = i
        
        if target_interview:
            print(f"\n--- Found Target Interview: {target_interview.candidate_name} ---")
            print(f"Status: {target_interview.status}")
            
            result = db.query(InterviewResult).filter(InterviewResult.interview_id == target_interview.id).first()
            if result:
                print(f"VAPI Call ID: {result.vapi_call_id}")
                print(f"Evaluation: {json.dumps(result.evaluation, indent=2) if result.evaluation else 'None'}")
            else:
                print("\n❌ No Result Record Found in DB (This means no webhook arrived to create it).")
        else:
            print("\n❌ Candidate 'ali' NOT found in DB.")
            
    except Exception as e:
        print(f"Error checking DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
