import os
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
    
    async def create_hr_assistant_overrides(
        self,
        candidate_name: str,
        role: str = "General HR Screening"
    ) -> dict:
        """
        Create assistant configuration overrides for General HR Screening interviews.
        Uses the pre-configured Vapi HR assistant without clobbering its system prompt.
        """
        base_assistant_id = settings.vapi_hr_assistant_id or "6389886e-f01e-4d5c-8583-a9bd75fe1a10"

        # Professional, structured first message matching the HR screening standard
        first_message = f"Hello {candidate_name}, and welcome to your HR screening interview with CandiMind. I'm your AI HR Interviewer. Today, we'll have a conversation about your background, experiences, working approach, and professional goals. Please feel free to take your time when answering. Let's begin. Could you tell me a little about yourself?"

        return {
            "assistantId": base_assistant_id,
            "assistantOverrides": {
                "firstMessage": first_message,
                "serverUrl": f"{settings.backend_url}/api/webhooks/vapi",
                "variableValues": {
                    "candidateName": candidate_name,
                    "role": role or "General HR Screening"
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


def extract_vapi_audio_url(payload: dict) -> str | None:
    """
    Extract best available audio recording URL from VAPI webhook payload or call details response.
    Prefers stereoRecordingUrl over recordingUrl.
    """
    if not isinstance(payload, dict):
        return None

    message_data = payload.get("message", {}) if isinstance(payload.get("message"), dict) else payload
    artifact = message_data.get("artifact", {}) if isinstance(message_data.get("artifact"), dict) else {}
    call = message_data.get("call", {}) if isinstance(message_data.get("call"), dict) else {}
    
    dicts_to_check = [artifact, message_data, call, payload]
    
    # 1. Prefer stereoRecordingUrl if available (contains both channels)
    for d in dicts_to_check:
        url = d.get("stereoRecordingUrl")
        if url and isinstance(url, str) and url.strip():
            return url.strip()
            
    # 2. Fallback to recordingUrl
    for d in dicts_to_check:
        url = d.get("recordingUrl")
        if url and isinstance(url, str) and url.strip():
            return url.strip()
            
    return None


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
AUDIO_UPLOADS_DIR = os.path.join(UPLOAD_DIR, "audio")
os.makedirs(AUDIO_UPLOADS_DIR, exist_ok=True)


async def download_and_save_vapi_audio(call_id: str, interview_id: int, payload: dict = None) -> str | None:
    """
    Downloads VAPI stereo audio recording server-side using backend authentication / presigned URLs,
    saves it to backend/uploads/audio/interview_{interview_id}_{call_id[:8]}_stereo.wav,
    and returns relative path: 'uploads/audio/interview_...'
    """
    call_details = payload or {}
    art = call_details.get("artifact", {}) if isinstance(call_details.get("artifact"), dict) else {}
    
    presigned_stereo = art.get("presignedStereoUrl") or call_details.get("presignedStereoUrl")
    presigned_mono = art.get("presignedMonoUrl") or call_details.get("presignedMonoUrl")
    stereo_url = art.get("stereoRecordingUrl") or call_details.get("stereoRecordingUrl") or art.get("recordingUrl") or call_details.get("recordingUrl")
    
    # If no presigned URL available in provided payload, fetch fresh call details from VAPI API
    if (not presigned_stereo and not presigned_mono) and call_id:
        print(f"🔄 Fetching fresh call details from VAPI API for call {call_id} to obtain presigned audio download URL...")
        call_details = await vapi_service.get_call_details(call_id)
        art = call_details.get("artifact", {}) if isinstance(call_details.get("artifact"), dict) else {}
        presigned_stereo = art.get("presignedStereoUrl") or call_details.get("presignedStereoUrl")
        presigned_mono = art.get("presignedMonoUrl") or call_details.get("presignedMonoUrl")
        stereo_url = art.get("stereoRecordingUrl") or call_details.get("stereoRecordingUrl") or art.get("recordingUrl") or call_details.get("recordingUrl")

    candidates = [url for url in [presigned_stereo, presigned_mono, stereo_url] if url and isinstance(url, str)]
    
    if not candidates:
        print(f"⚠️ No downloadable audio URL found for VAPI call {call_id}")
        return None
        
    short_call_id = call_id[:8] if call_id else "vapi"
    filename = f"interview_{interview_id}_{short_call_id}_stereo.wav"
    file_path = os.path.join(AUDIO_UPLOADS_DIR, filename)
    relative_path = f"uploads/audio/{filename}"
    
    # Check if already downloaded
    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        print(f"✅ Local VAPI audio file already exists ({os.path.getsize(file_path)} bytes): {relative_path}")
        return relative_path

    async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
        for target_url in candidates:
            try:
                print(f"📥 Attempting server-side download of VAPI audio from: {target_url[:70]}...")
                # First try without auth header (necessary for S3/R2 presigned URLs)
                response = await client.get(target_url)
                if response.status_code != 200:
                    # Fallback try with VAPI bearer token
                    headers = {"Authorization": f"Bearer {settings.vapi_api_key}"}
                    response = await client.get(target_url, headers=headers)
                
                if response.status_code == 200 and len(response.content) > 0:
                    with open(file_path, "wb") as f:
                        f.write(response.content)
                    print(f"✅ VAPI Audio downloaded server-side ({len(response.content)} bytes) saved to: {file_path}")
                    return relative_path
                else:
                    print(f"⚠️ Server-side download failed (Status {response.status_code}) for URL: {target_url[:60]}")
            except Exception as e:
                print(f"⚠️ Error during VAPI audio download: {e}")

    return None


def try_merge_interview_media(interview_id: int, db, force_remerge: bool = False) -> str | None:
    """
    Merges candidate original webcam video (.webm) and VAPI stereo audio (.wav) into a single combined
    synchronized video file using FFmpeg timestamp alignment (adelay / atrim + aresample).
    Never overwrites original files.
    Updates InterviewResult.merged_video_path to the synchronized final video path.
    """
    from models import InterviewResult
    import subprocess
    import imageio_ffmpeg

    result = db.query(InterviewResult).filter(InterviewResult.interview_id == interview_id).first()
    if not result:
        return None

    # Guard: If recording is already a combined A/V recording (screen_pip_av or combined_av),
    # both candidate and assistant audio are already embedded in the video. Do NOT run legacy merge!
    if result.integrity_summary and isinstance(result.integrity_summary, dict):
        rec_type = result.integrity_summary.get("recording_type")
        if rec_type in ["screen_pip_av", "combined_av"] or result.integrity_summary.get("screen_recording_enabled"):
            print(f"✅ Interview #{interview_id} already has complete A/V recording ({rec_type}). Skipping legacy audio merge.")
            return result.merged_video_path or result.recording_video_path

    # Always use original webcam video and original VAPI audio
    video_rel = result.recording_video_path
    audio_rel = result.vapi_audio_url

    if not video_rel or not audio_rel:
        print(f"⏳ Waiting for interview #{interview_id} media: video present={bool(video_rel)}, audio present={bool(audio_rel)}")
        return None

    base_dir = os.path.dirname(os.path.dirname(__file__))
    video_abs = os.path.join(base_dir, video_rel.lstrip('/\\')) if not os.path.isabs(video_rel) else video_rel
    audio_abs = os.path.join(base_dir, audio_rel.lstrip('/\\')) if not os.path.isabs(audio_rel) else audio_rel

    if not os.path.exists(video_abs) or not os.path.exists(audio_abs):
        print(f"⏳ Waiting for files on disk for interview #{interview_id}: video exists={os.path.exists(video_abs)}, audio exists={os.path.exists(audio_abs)}")
        return None

    # Step 9: Check if merged_video_path already exists to avoid duplicate merges
    if result.merged_video_path and not force_remerge:
        merged_existing_abs = os.path.join(base_dir, result.merged_video_path.lstrip('/\\'))
        if os.path.exists(merged_existing_abs) and os.path.getsize(merged_existing_abs) > 0:
            print(f"✅ Merged synchronized video already exists: {result.merged_video_path}")
            return result.merged_video_path

    # Extract or calculate sync timestamp offset
    # IMPORTANT: The client-side vapi_started_at_ms is captured when the browser receives
    # the 'call-start' event, which fires AFTER WebRTC negotiation (~5-10s delay).
    # But VAPI's server actually starts recording at call.createdAt time.
    # We must use the server-side timestamp to avoid over-delaying the audio.
    
    video_started = result.video_started_at_ms
    vapi_started = result.vapi_started_at_ms  # client-side (inaccurate for sync)
    
    # Try to get more accurate server-side VAPI start time from webhook data
    vapi_server_started_ms = None
    if result.raw_webhook_data:
        webhook = result.raw_webhook_data if isinstance(result.raw_webhook_data, dict) else {}
        call_data = webhook.get("call", {})
        # VAPI provides createdAt or startedAt in ISO format
        server_ts_str = call_data.get("startedAt") or call_data.get("createdAt")
        if server_ts_str:
            try:
                from datetime import datetime as dt_parse
                # Parse ISO timestamp to epoch ms
                ts = dt_parse.fromisoformat(server_ts_str.replace("Z", "+00:00"))
                vapi_server_started_ms = ts.timestamp() * 1000
                print(f"🎯 Using VAPI server-side timestamp: {server_ts_str} -> {vapi_server_started_ms} ms")
            except Exception as e:
                print(f"⚠️ Failed to parse VAPI server timestamp '{server_ts_str}': {e}")

    # Also check integrity_summary for client-side timestamps
    if result.integrity_summary:
        summary = result.integrity_summary if isinstance(result.integrity_summary, dict) else {}
        if video_started is None:
            video_started = summary.get("video_recording_started_at_ms")
        if vapi_started is None:
            vapi_started = summary.get("vapi_call_started_at_ms")

    # Calculate offset: prefer server-side VAPI timestamp over client-side
    if video_started is not None and vapi_server_started_ms is not None:
        audio_offset_ms = vapi_server_started_ms - video_started
        print(f"⏱️ Using SERVER-SIDE offset: {audio_offset_ms:.0f} ms (video={video_started}, vapi_server={vapi_server_started_ms})")
    elif video_started is not None and vapi_started is not None:
        # Fallback to client-side timestamps (less accurate due to WebRTC delay)
        audio_offset_ms = vapi_started - video_started
        print(f"⚠️ Using CLIENT-SIDE offset (less accurate): {audio_offset_ms:.0f} ms")
    else:
        audio_offset_ms = 0.0
        print(f"⚠️ No sync timestamps available, using 0 ms offset")

    # Save calculated sync fields in DB
    result.audio_offset_ms = audio_offset_ms
    result.video_started_at_ms = video_started
    result.vapi_started_at_ms = vapi_started

    print(f"⏱️ Final Sync Offset for Interview #{interview_id}: {audio_offset_ms:.0f} ms")

    # Step 4: Construct FFmpeg audio filter based on positive/negative offset
    if audio_offset_ms > 0:
        # VAPI call started AFTER webcam recording -> delay audio
        delay_int = int(round(audio_offset_ms))
        af_filter = f"adelay={delay_int}|{delay_int},aresample=async=1:first_pts=0"
    elif audio_offset_ms < 0:
        # VAPI call started BEFORE webcam recording -> trim audio
        trim_sec = round(abs(audio_offset_ms) / 1000.0, 3)
        af_filter = f"atrim=start={trim_sec},asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0"
    else:
        af_filter = "aresample=async=1:first_pts=0"

    dir_name = os.path.dirname(video_abs)
    base_name = os.path.splitext(os.path.basename(video_abs))[0]
    clean_base = base_name.replace("_merged", "").replace("_final", "")
    merged_filename = f"{clean_base}_final.mp4"
    merged_abs = os.path.join(dir_name, merged_filename)
    merged_rel = f"uploads/interviews/{merged_filename}"

    print(f"🎬 Merging candidate video + VAPI audio with FFmpeg filter [{af_filter}] for interview #{interview_id}...")
    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [
            ffmpeg_exe, "-y",
            "-fflags", "+genpts",
            "-i", video_abs,
            "-i", audio_abs,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "26",
            "-af", af_filter,
            "-c:a", "aac",
            "-movflags", "+faststart",
            merged_abs
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode == 0 and os.path.exists(merged_abs) and os.path.getsize(merged_abs) > 0:
            print(f"✅ FFmpeg merge successful! ({os.path.getsize(merged_abs)} bytes) -> {merged_rel}")
            result.merged_video_path = merged_rel
            db.commit()
            return merged_rel
        else:
            print(f"⚠️ FFmpeg merge error (code {proc.returncode}): {proc.stderr[:400]}")
    except Exception as e:
        print(f"⚠️ FFmpeg execution exception: {e}")

    return None


# Alias for backward compatibility
merge_video_and_audio = try_merge_interview_media


# Singleton instance
vapi_service = VAPIService()
