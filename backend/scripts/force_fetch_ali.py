import sys
import os
import asyncio
import httpx
import json

# Fix path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Interview, InterviewResult
from config import get_settings

settings = get_settings()

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

async def force_fetch_ali():
    db = SessionLocal()
    try:
        # 1. Find Interview (Latest)
        interviews = db.query(Interview).order_by(Interview.id.desc()).all()
        target_interview = None
        for i in interviews:
            if "ali" in i.candidate_name.lower():
                target_interview = i
                break
        
        if not target_interview:
            print("❌ Candidate 'ali' not found.")
            return

        print(f"✅ Found Interview: {target_interview.candidate_name} (ID: {target_interview.id})")
        
        # 2. Get Call ID
        result_record = db.query(InterviewResult).filter(InterviewResult.interview_id == target_interview.id).first()
        if not result_record or not result_record.vapi_call_id:
            print("❌ No Call ID linked! Run link_call_manual.py first.")
            return
            
        call_id = result_record.vapi_call_id
        print(f"Found Linked Call ID: {call_id}")
        
        # 3. Fetch from VAPI
        headers = {
            "Authorization": f"Bearer {settings.vapi_api_key}",
            "Content-Type": "application/json"
        }
        
        print(f"Fetching data from VAPI...")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.vapi.ai/call/{call_id}",
                headers=headers
            )
            
            if response.status_code != 200:
                print(f"❌ VAPI Error: {response.text}")
                return
                
            call_details = response.json()
            
            # 4. Parse Data (Using EXACT logic from interviews.py)
            structured_outputs = call_details.get("artifact", {}).get("structuredOutputs", {})
            print(f"Raw Structured Outputs Keys: {list(structured_outputs.keys())}")
            
            evaluation_data = None
            found_name = None
            
            for output_id, output_data in structured_outputs.items():
                name = output_data.get("name")
                print(f"Checking Output: {name}")
                # Logic from interviews.py
                if name in ["Interview_Evaluation", "Backend_Interview_Evaluation"]:
                    evaluation_data = output_data.get("result")
                    found_name = name
                    break
            
            if evaluation_data:
                print(f"✅ Extracted Evaluation Data! (Schema: {found_name})")
                
                # Update DB
                result_record.evaluation = evaluation_data
                result_record.transcript = call_details.get("transcript", "")
                result_record.summary = call_details.get("analysis", {}).get("summary", "")
                
                # Calculate duration
                started_at = call_details.get("startedAt")
                ended_at = call_details.get("endedAt")
                if started_at and ended_at:
                    start = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                    end = datetime.fromisoformat(ended_at.replace('Z', '+00:00'))
                    result_record.call_duration = (end - start).total_seconds()
                
                db.commit()
                print("💾 Saved to Database successfully!")
                print("Score:", evaluation_data.get("overall_score"))
            else:
                print("❌ Failed to extract data. Valid schema names not found.")
                print("Available names:", [v.get('name') for k,v in structured_outputs.items()])

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

from datetime import datetime

if __name__ == "__main__":
    asyncio.run(force_fetch_ali())
