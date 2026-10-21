import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Vapi from '@vapi-ai/web';
import { interviewAPI } from '../services/api';
import { 
    Mic, MicOff, Phone, PhoneOff, Loader, Video, VideoOff, 
    AlertCircle, Monitor, ShieldCheck, CheckCircle2, Volume2, 
    Lock, Sparkles, ChevronRight, RefreshCw, UserCheck,
    Eye, EyeOff, Link2, Key, Info, HelpCircle, ExternalLink, ArrowRight
} from 'lucide-react';

export default function CandidateInterview() {
    const { uniqueId } = useParams();
    const navigate = useNavigate();
    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Candidate Authentication & Session Resolution (Screen 1)
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [enteredId, setEnteredId] = useState(uniqueId || '');
    const [resolvedId, setResolvedId] = useState(uniqueId || '');
    const [passwordError, setPasswordError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [showRequirementsTip, setShowRequirementsTip] = useState(false);

    // Onboarding step for 3-step candidate stepper: 'welcome' | 'setup' | 'interview'
    const [onboardingStep, setOnboardingStep] = useState('welcome');

    // Hardware setup & test state (Screen 3)
    const [setupCamReady, setSetupCamReady] = useState(false);
    const [setupMicReady, setSetupMicReady] = useState(false);
    const [setupScreenReady, setSetupScreenReady] = useState(false);
    const [micVolumeLevel, setMicVolumeLevel] = useState(0); // 0 to 10
    const [camDeviceName, setCamDeviceName] = useState('Integrated Camera (HD)');
    const [micDeviceName, setMicDeviceName] = useState('Default - Microphone');
    const [audioTestPlaying, setAudioTestPlaying] = useState(false);

    // VAPI call state (Screen 4)
    const [vapiInstance, setVapiInstance] = useState(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, active, ended
    const [assistantMessage, setAssistantMessage] = useState('');
    const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
    const [vapiRemoteStream, setVapiRemoteStream] = useState(null);
    const [callDurationSeconds, setCallDurationSeconds] = useState(0);

    // Recording & Integrity State
    const [cameraActive, setCameraActive] = useState(false);
    const [screenActive, setScreenActive] = useState(false);
    const [screenWarning, setScreenWarning] = useState(false);
    const [recordingStatus, setRecordingStatus] = useState('idle'); // idle, ready, recording, uploading, uploaded, error
    const [uploadError, setUploadError] = useState(null);

    // Integrity Counters
    const [integrityCounts, setIntegrityCounts] = useState({
        tabSwitchCount: 0,
        windowBlurCount: 0,
        fullscreenExitCount: 0,
        cameraInterruptionCount: 0,
        screenInterruptionCount: 0,
    });

    // Refs for streams, PiP compositor, recorder, and video elements
    const videoRef = useRef(null);
    const setupVideoRef = useRef(null);
    const mediaStreamRef = useRef(null);          // Original camera-only stream
    const screenStreamRef = useRef(null);         // Screen share stream
    const screenVideoElRef = useRef(null);        // Offscreen video element playing screen stream
    const cameraVideoElRef = useRef(null);        // Offscreen video element playing camera stream
    const pipCanvasRef = useRef(null);            // Offscreen canvas compositing screen + camera PiP
    const pipAnimationIdRef = useRef(null);       // RequestAnimationFrame ID for PiP loop
    const combinedStreamRef = useRef(null);       // Combined stream (PiP video + mixed audio) for recording
    const micStreamRef = useRef(null);            // Separate mic stream for audio mixing
    const audioContextRef = useRef(null);         // Web Audio API context for mixing
    const analyserRef = useRef(null);             // AnalyserNode for volume meter
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const integrityEventsRef = useRef([]);
    const isUploadingRef = useRef(false);
    const vapiCallStartedRef = useRef(false);
    const isNormalStoppingRef = useRef(false);
    const videoRecordingStartTimestampRef = useRef(null);
    const vapiCallStartTimestampRef = useRef(null);
    const vapiAudioConnectedRef = useRef(false);   // Whether VAPI remote audio has been mixed in
    const vapiInstanceRef = useRef(null);          // Stable reference to vapi instance
    const isRecordingStartedRef = useRef(false);   // True only when interviewer starts and recorder.start() is called
    const audioObserverRef = useRef(null);         // MutationObserver for <audio> elements
    const audioPollIntervalRef = useRef(null);     // Active interval to detect VAPI audio stream
    const connectedAudioTrackIdsRef = useRef(new Set()); // Set of audio track IDs currently mixed in

    // Sync URL uniqueId with state when available
    useEffect(() => {
        if (uniqueId) {
            setResolvedId(uniqueId);
            setEnteredId(uniqueId);
        }
    }, [uniqueId]);

    // 1. Load interview data after password verification
    useEffect(() => {
        if (passwordVerified && (resolvedId || uniqueId)) {
            loadInterview(resolvedId || uniqueId);
        }
    }, [passwordVerified, resolvedId, uniqueId]);

    // 2. Timer for live interview call duration
    useEffect(() => {
        let interval = null;
        if (callStatus === 'active') {
            interval = setInterval(() => {
                setCallDurationSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callStatus]);

    // 3. Cleanup resources on unmount
    useEffect(() => {
        return () => {
            cleanupAllMedia();
            removeIntegrityListeners();
        };
    }, []);

    // 4. Attach camera stream to live video preview elements when active
    useEffect(() => {
        if (cameraActive && videoRef.current && mediaStreamRef.current) {
            videoRef.current.srcObject = mediaStreamRef.current;
            videoRef.current.play().catch(e => console.error("Preview play error:", e));
        }
    }, [cameraActive, callStatus, onboardingStep]);

    // 5. Attach preview in Setup Step (Screen 3)
    useEffect(() => {
        if (onboardingStep === 'setup' && setupVideoRef.current && mediaStreamRef.current) {
            setupVideoRef.current.srcObject = mediaStreamRef.current;
            setupVideoRef.current.play().catch(e => console.error("Setup preview play error:", e));
        }
    }, [onboardingStep, setupCamReady]);

    // Log integrity violation
    const logIntegrityEvent = (eventType, metadata = {}) => {
        const timestamp = new Date().toISOString();
        const event = { type: eventType, timestamp, ...metadata };
        integrityEventsRef.current.push(event);

        if (eventType === 'tab_hidden') {
            setIntegrityCounts(prev => ({ ...prev, tabSwitchCount: prev.tabSwitchCount + 1 }));
        } else if (eventType === 'window_blur') {
            setIntegrityCounts(prev => ({ ...prev, windowBlurCount: prev.windowBlurCount + 1 }));
        } else if (eventType === 'fullscreen_exited') {
            setIntegrityCounts(prev => ({ ...prev, fullscreenExitCount: prev.fullscreenExitCount + 1 }));
        } else if (eventType === 'camera_stopped') {
            setIntegrityCounts(prev => ({ ...prev, cameraInterruptionCount: prev.cameraInterruptionCount + 1 }));
        } else if (eventType === 'screen_stopped') {
            setIntegrityCounts(prev => ({ ...prev, screenInterruptionCount: (prev.screenInterruptionCount || 0) + 1 }));
        }
    };

    const attachIntegrityListeners = () => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                logIntegrityEvent('tab_hidden');
            } else {
                logIntegrityEvent('tab_visible');
            }
        };

        const handleWindowBlur = () => logIntegrityEvent('window_blur');
        const handleWindowFocus = () => logIntegrityEvent('window_focus');

        const handleFullscreenChange = () => {
            if (document.fullscreenElement) {
                logIntegrityEvent('fullscreen_entered');
            } else {
                logIntegrityEvent('fullscreen_exited');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        window._integrityCleanups = [
            () => document.removeEventListener('visibilitychange', handleVisibilityChange),
            () => window.removeEventListener('blur', handleWindowBlur),
            () => window.removeEventListener('focus', handleWindowFocus),
            () => document.removeEventListener('fullscreenchange', handleFullscreenChange),
        ];
    };

    const removeIntegrityListeners = () => {
        if (window._integrityCleanups) {
            window._integrityCleanups.forEach(cleanup => cleanup());
            window._integrityCleanups = null;
        }
    };

    const cleanupAllMedia = () => {
        isNormalStoppingRef.current = true;
        isRecordingStartedRef.current = false;
        vapiAudioConnectedRef.current = false;
        vapiCallStartedRef.current = false;
        isUploadingRef.current = false;
        setIsAssistantSpeaking(false);
        setVapiRemoteStream(null);

        if (pipAnimationIdRef.current) {
            cancelAnimationFrame(pipAnimationIdRef.current);
            pipAnimationIdRef.current = null;
        }

        if (screenVideoElRef.current) {
            screenVideoElRef.current.srcObject = null;
            if (screenVideoElRef.current.parentNode) {
                screenVideoElRef.current.parentNode.removeChild(screenVideoElRef.current);
            }
            screenVideoElRef.current = null;
        }
        if (cameraVideoElRef.current) {
            cameraVideoElRef.current.srcObject = null;
            if (cameraVideoElRef.current.parentNode) {
                cameraVideoElRef.current.parentNode.removeChild(cameraVideoElRef.current);
            }
            cameraVideoElRef.current = null;
        }

        if (audioObserverRef.current) {
            audioObserverRef.current.disconnect();
            audioObserverRef.current = null;
        }

        if (audioPollIntervalRef.current) {
            clearInterval(audioPollIntervalRef.current);
            audioPollIntervalRef.current = null;
        }

        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }
        setScreenActive(false);

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
        }

        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
            audioContextRef.current = null;
        }
        if (connectedAudioTrackIdsRef.current) {
            connectedAudioTrackIdsRef.current.clear();
        }
        combinedStreamRef.current = null;
        setCameraActive(false);
    };

    // Smart ID extractor: extracts clean ID from raw string, full URL, or query parameter
    const extractInterviewId = (raw) => {
        if (!raw) return '';
        const trimmed = raw.trim();
        // 1. Match path /interview/:id or /candidate/:id
        const urlMatch = trimmed.match(/(?:interview|candidate|uid)\/([a-zA-Z0-9_-]+)/i);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
        }
        // 2. Match query param ?id=... or ?uid=...
        const queryMatch = trimmed.match(/[?&](?:id|uid|unique_id)=([a-zA-Z0-9_-]+)/i);
        if (queryMatch && queryMatch[1]) {
            return queryMatch[1];
        }
        // 3. Last path segment if full URL
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            try {
                const parsed = new URL(trimmed);
                const segments = parsed.pathname.split('/').filter(Boolean);
                if (segments.length > 0) {
                    return segments[segments.length - 1];
                }
            } catch (e) {
                // ignore
            }
        }
        // 4. Return clean trimmed string
        return trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
    };

    // Password & Session verification handler (Screen 1)
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordError('');

        const cleanId = extractInterviewId(enteredId || uniqueId);
        if (!cleanId) {
            setPasswordError('Please provide your Interview ID or paste your interview invitation link.');
            return;
        }

        if (!password.trim()) {
            setPasswordError('Please enter the 6-character access password from your invitation.');
            return;
        }

        setVerifying(true);
        try {
            const cleanPassword = password.trim().toUpperCase();
            const result = await interviewAPI.verifyPassword(cleanId, cleanPassword);
            if (result.valid) {
                setResolvedId(cleanId);
                setPasswordVerified(true);
                setOnboardingStep('welcome');
                if (uniqueId !== cleanId) {
                    navigate(`/interview/${cleanId}`, { replace: true });
                }
                await loadInterview(cleanId);
            } else {
                setPasswordError(result.message || 'Invalid access password. Passwords are 6 alphanumeric characters.');
            }
        } catch (err) {
            console.error('Error verifying credentials:', err);
            if (err.response && err.response.status === 404) {
                setPasswordError('Interview session not found. Please double-check your Interview ID or invitation link.');
            } else {
                setPasswordError('Unable to connect to verification server. Please check your network connection.');
            }
        } finally {
            setVerifying(false);
        }
    };

    /**
     * Connect an audio MediaStream or MediaStreamTrack into the Web Audio API mix destination.
     */
    const connectStreamOrTrackToMix = (streamOrTrack, sourceInfo = "unknown") => {
        const audioCtx = audioContextRef.current;
        if (!audioCtx || !audioCtx._mixDestination) {
            return false;
        }

        try {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            let stream = null;
            let trackId = null;
            if (streamOrTrack instanceof MediaStream) {
                stream = streamOrTrack;
                trackId = stream.getAudioTracks()[0]?.id;
            } else if (streamOrTrack instanceof MediaStreamTrack) {
                stream = new MediaStream([streamOrTrack]);
                trackId = streamOrTrack.id;
            } else {
                return false;
            }

            if (!stream) return false;
            const audioTracks = stream.getAudioTracks();
            if (!audioTracks || audioTracks.length === 0) return false;

            const activeTrack = audioTracks[0];
            if (activeTrack.readyState === 'ended') return false;

            if (trackId && connectedAudioTrackIdsRef.current.has(trackId)) {
                return true;
            }

            console.log(`🔊 Connecting audio track (${sourceInfo}) to recording mix. Track: ${activeTrack.label || trackId}`);
            const sourceNode = audioCtx.createMediaStreamSource(stream);
            sourceNode.connect(audioCtx._mixDestination);
            if (trackId) {
                connectedAudioTrackIdsRef.current.add(trackId);
            }
            vapiAudioConnectedRef.current = true;
            setVapiRemoteStream(stream);
            logIntegrityEvent('audio_track_mixed', { sourceInfo, trackId: activeTrack.id });
            return true;
        } catch (err) {
            console.error("⚠️ Failed to connect audio stream to mix:", err);
            return false;
        }
    };

    /**
     * Scan DOM <audio> elements and Daily call participants for audio streams.
     */
    const scanAndConnectVapiAudio = () => {
        const audioEls = Array.from(document.querySelectorAll('audio'));
        for (const el of audioEls) {
            try {
                el.muted = false;
                el.volume = 1.0;
                if (el.paused) {
                    el.play().catch(e => console.log("Audio resume attempt:", e.message));
                }
            } catch (e) { /* ignore */ }

            if (el.srcObject && typeof el.srcObject.getAudioTracks === 'function') {
                const tracks = el.srcObject.getAudioTracks();
                if (tracks.length > 0 && tracks.some(t => t.readyState === 'live')) {
                    connectStreamOrTrackToMix(el.srcObject, `DOM <audio> (${el.dataset?.participantId || 'daily-audio'})`);
                }
            }
        }

        try {
            const vapi = vapiInstanceRef.current;
            if (vapi && vapi.call && typeof vapi.call.participants === 'function') {
                const participants = vapi.call.participants();
                for (const pid in participants) {
                    const p = participants[pid];
                    if (p) {
                        if (p.audioTrack && p.audioTrack.readyState === 'live') {
                            connectStreamOrTrackToMix(p.audioTrack, `Daily ${p.local ? 'Local Mic' : 'Remote Assistant'} (${pid})`);
                        }
                        const persistentTrack = p.tracks?.audio?.persistentTrack;
                        if (persistentTrack && persistentTrack.readyState === 'live') {
                            connectStreamOrTrackToMix(persistentTrack, `Daily ${p.local ? 'Local Mic' : 'Remote Assistant'} persistentTrack (${pid})`);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Daily participants check warning:", e);
        }
    };

    const startAudioPolling = () => {
        let attempts = 0;
        if (audioPollIntervalRef.current) clearInterval(audioPollIntervalRef.current);
        audioPollIntervalRef.current = setInterval(() => {
            attempts++;
            const connected = scanAndConnectVapiAudio();
            if (attempts === 15 && (!connectedAudioTrackIdsRef.current || connectedAudioTrackIdsRef.current.size === 0)) {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    navigator.mediaDevices.getUserMedia({ audio: true })
                        .then(stream => {
                            micStreamRef.current = stream;
                            connectStreamOrTrackToMix(stream, 'Fallback local microphone');
                        })
                        .catch(err => console.warn("Fallback mic capture skipped:", err.message));
                }
            }
            if (connected || attempts > 50) {
                clearInterval(audioPollIntervalRef.current);
                audioPollIntervalRef.current = null;
            }
        }, 200);
    };

    /**
     * Starts MediaRecorder ONLY when the interviewer actually starts.
     */
    const startRecordingWhenInterviewerStarts = (trigger = "interviewer-ready") => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) {
            console.warn("⚠️ MediaRecorder not ready when interviewer started");
            return;
        }

        if (recorder.state === 'inactive') {
            isRecordingStartedRef.current = true;
            recordedChunksRef.current = [];
            recorder.start(1000); // 1-second chunks
            videoRecordingStartTimestampRef.current = Date.now();
            console.log(`🎬 Recording STARTED now that interviewer has started (trigger: ${trigger}) at:`, videoRecordingStartTimestampRef.current);
            setRecordingStatus('recording');
            logIntegrityEvent('recording_started', {
                trigger,
                startedAt: videoRecordingStartTimestampRef.current,
                mimeType: recorder.mimeType,
                hasMic: (connectedAudioTrackIdsRef.current && connectedAudioTrackIdsRef.current.size > 0) || !!micStreamRef.current
            });
        }
    };

    const loadInterview = async (targetId) => {
        const idToLoad = targetId || resolvedId || uniqueId;
        if (!idToLoad) return;
        setLoading(true);
        setError(null);
        try {
            const data = await interviewAPI.getInterviewByUID(idToLoad);
            setInterview(data);

            const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
            if (!publicKey) {
                throw new Error('VAPI public key not configured');
            }
            const vapi = new Vapi(publicKey);
            setVapiInstance(vapi);
            vapiInstanceRef.current = vapi;

            vapi.on('call-start', () => {
                vapiCallStartTimestampRef.current = Date.now();
                console.log('📞 VAPI Call started at timestamp:', vapiCallStartTimestampRef.current);
                setIsCallActive(true);
                setCallStatus('active');
                vapiCallStartedRef.current = true;

                startRecordingWhenInterviewerStarts('call-start');
                scanAndConnectVapiAudio();
                startAudioPolling();
            });

            vapi.on('call-end', () => {
                console.log('📞 VAPI Call ended. Call started flag was:', vapiCallStartedRef.current);
                setIsCallActive(false);
                setIsAssistantSpeaking(false);

                if (!vapiCallStartedRef.current) {
                    setCallStatus('idle');
                    setRecordingStatus('idle');
                    cleanupAllMedia();
                    removeIntegrityListeners();
                    return;
                }

                setCallStatus('ended');
                stopRecordingAndUpload();
            });

            vapi.on('speech-start', () => {
                setIsAssistantSpeaking(true);
                startRecordingWhenInterviewerStarts('speech-start');
                scanAndConnectVapiAudio();
            });

            vapi.on('speech-end', () => {
                setIsAssistantSpeaking(false);
            });

            vapi.on('message', (message) => {
                if (message.type === 'transcript' && message.role === 'assistant') {
                    setAssistantMessage(message.transcript);
                }
                scanAndConnectVapiAudio();
            });

            vapi.on('error', (vapiError) => {
                console.error('VAPI Error Event:', vapiError);
                let errorDisplay = 'Microphone connection or device access error';
                try {
                    if (typeof vapiError === 'string') errorDisplay = vapiError;
                    else if (vapiError?.message) errorDisplay = String(vapiError.message);
                } catch (e) {}

                if (errorDisplay.includes('ejected') || errorDisplay.includes('ended')) {
                    if (vapiCallStartedRef.current) {
                        setCallStatus('ended');
                        setIsCallActive(false);
                        stopRecordingAndUpload();
                    }
                    return;
                }

                if (!vapiCallStartedRef.current) {
                    setCallStatus('idle');
                    setRecordingStatus('idle');
                    cleanupAllMedia();
                    removeIntegrityListeners();
                }

                setError(`Interview Error: ${errorDisplay}. Please check your audio permissions and try again.`);
            });

        } catch (err) {
            console.error('Error loading interview:', err);
            setError('Interview not found or has expired.');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Hardware Pre-Flight Setup for Screen 3:
     * Obtains camera, microphone, and starts analyser for live volume meter.
     */
    const startHardwarePreFlight = async () => {
        try {
            setError(null);
            // 1. Request camera and microphone
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
                audio: true
            });

            const videoTracks = mediaStream.getVideoTracks();
            const audioTracks = mediaStream.getAudioTracks();

            if (videoTracks.length > 0) {
                setSetupCamReady(true);
                setCamDeviceName(videoTracks[0].label || 'Integrated Camera (HD)');
            }
            if (audioTracks.length > 0) {
                setSetupMicReady(true);
                setMicDeviceName(audioTracks[0].label || 'Default - Microphone');
            }

            mediaStreamRef.current = new MediaStream(videoTracks);
            micStreamRef.current = new MediaStream(audioTracks);

            // Connect setup video element
            if (setupVideoRef.current) {
                setupVideoRef.current.srcObject = mediaStreamRef.current;
                setupVideoRef.current.play().catch(e => console.warn("Preview play error:", e));
            }

            // Web Audio Analyser for VU meter
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            audioContextRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(micStreamRef.current);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateMeter = () => {
                if (analyserRef.current) {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const avg = sum / dataArray.length;
                    const level = Math.min(10, Math.floor((avg / 128) * 10));
                    setMicVolumeLevel(level);
                    requestAnimationFrame(updateMeter);
                }
            };
            requestAnimationFrame(updateMeter);

        } catch (err) {
            console.error("Hardware pre-flight error:", err);
            setError("Could not access camera or microphone. Please ensure browser permissions are allowed.");
        }
    };

    // Play test audio sound (Screen 3)
    const playTestAudio = () => {
        try {
            setAudioTestPlaying(true);
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;

            // Chime Note 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.frequency.setValueAtTime(440, now);
            gain1.gain.setValueAtTime(0.12, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Chime Note 2
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.frequency.setValueAtTime(880, now + 0.2);
            gain2.gain.setValueAtTime(0.18, now + 0.2);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.2);
            osc2.stop(now + 0.65);

            setTimeout(() => setAudioTestPlaying(false), 700);
        } catch (e) {
            console.warn("Audio test error:", e);
            setAudioTestPlaying(false);
        }
    };

    // Screen sharing authorization in Setup (Screen 3)
    const authorizeScreenShareInSetup = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error("Screen sharing is not supported by your browser. Please use Chrome, Edge, or Firefox.");
            }
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "monitor", frameRate: { ideal: 30 } },
                audio: false
            });
            screenStreamRef.current = screenStream;
            setSetupScreenReady(true);
            setScreenActive(true);

            const screenTrack = screenStream.getVideoTracks()[0];
            if (screenTrack) {
                screenTrack.onended = () => {
                    setSetupScreenReady(false);
                    setScreenActive(false);
                };
            }
        } catch (err) {
            console.error("Screen share setup error:", err);
            setError("Screen sharing was cancelled or denied. Proctoring requires sharing your Entire Screen.");
        }
    };

    /**
     * Initializes the final Canvas Compositor, Web Audio Destination, and MediaRecorder instance.
     */
    const startCameraAndRecorder = async () => {
        isNormalStoppingRef.current = false;
        vapiAudioConnectedRef.current = false;
        isRecordingStartedRef.current = false;

        try {
            // STEP 1: Ensure screen stream is acquired
            let screenStream = screenStreamRef.current;
            if (!screenStream || !screenStream.active) {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: "monitor", frameRate: { ideal: 30 } },
                    audio: false
                });
                screenStreamRef.current = screenStream;
            }
            setScreenActive(true);
            setScreenWarning(false);

            const screenTrack = screenStream.getVideoTracks()[0];
            if (screenTrack) {
                screenTrack.onended = () => {
                    if (!isNormalStoppingRef.current) {
                        logIntegrityEvent('screen_stopped');
                        setScreenActive(false);
                        setScreenWarning(true);
                    }
                };
            }

            // STEP 2: Ensure camera stream is acquired
            let cameraStream = mediaStreamRef.current;
            if (!cameraStream || !cameraStream.active) {
                cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
                    audio: false
                });
                mediaStreamRef.current = cameraStream;
            }
            setCameraActive(true);

            if (videoRef.current) {
                videoRef.current.srcObject = cameraStream;
                videoRef.current.play().catch(e => console.error("Preview play error:", e));
            }

            // STEP 3: Setup Web Audio API mixer
            let audioCtx = audioContextRef.current;
            if (!audioCtx || audioCtx.state === 'closed') {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                audioContextRef.current = audioCtx;
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const mixDestination = audioCtx.createMediaStreamDestination();
            audioCtx._mixDestination = mixDestination;

            // Connect local microphone stream if available
            if (micStreamRef.current) {
                connectStreamOrTrackToMix(micStreamRef.current, 'Candidate Microphone');
            }

            // STEP 4: Offscreen video elements for Canvas PiP
            let screenVideo = screenVideoElRef.current;
            if (!screenVideo) {
                screenVideo = document.createElement('video');
                screenVideo.autoplay = true;
                screenVideo.muted = true;
                screenVideo.playsInline = true;
                screenVideo.style.position = 'fixed';
                screenVideo.style.top = '-9999px';
                screenVideo.style.left = '-9999px';
                document.body.appendChild(screenVideo);
                screenVideoElRef.current = screenVideo;
            }
            screenVideo.srcObject = screenStream;
            screenVideo.play().catch(e => console.warn("screenVideo play:", e));

            let cameraVideo = cameraVideoElRef.current;
            if (!cameraVideo) {
                cameraVideo = document.createElement('video');
                cameraVideo.autoplay = true;
                cameraVideo.muted = true;
                cameraVideo.playsInline = true;
                cameraVideo.style.position = 'fixed';
                cameraVideo.style.top = '-9999px';
                cameraVideo.style.left = '-9999px';
                document.body.appendChild(cameraVideo);
                cameraVideoElRef.current = cameraVideo;
            }
            cameraVideo.srcObject = cameraStream;
            cameraVideo.play().catch(e => console.warn("cameraVideo play:", e));

            // STEP 5: Canvas Compositor (1280x720)
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            pipCanvasRef.current = canvas;

            const drawPipFrame = () => {
                if (isNormalStoppingRef.current) return;

                // 1. Dark canvas background
                ctx.fillStyle = '#0B132B';
                ctx.fillRect(0, 0, 1280, 720);

                // 2. Draw Screen Share
                if (screenVideo.readyState >= 2 && screenVideo.videoWidth > 0 && screenTrack && screenTrack.readyState === 'live') {
                    const sw = screenVideo.videoWidth;
                    const sh = screenVideo.videoHeight;
                    const scale = Math.min(1280 / sw, 720 / sh);
                    const dw = sw * scale;
                    const dh = sh * scale;
                    const dx = (1280 - dw) / 2;
                    const dy = (720 - dh) / 2;
                    ctx.drawImage(screenVideo, dx, dy, dw, dh);
                } else {
                    ctx.fillStyle = '#111D38';
                    ctx.fillRect(0, 0, 1280, 720);
                    ctx.fillStyle = '#EF4444';
                    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚠️ Screen Sharing Disconnected or Paused', 640, 340);
                }

                // 3. Draw Camera Inset in Bottom-Right Corner (280x180)
                const pipW = 280;
                const pipH = 180;
                const pipX = 1280 - pipW - 24;
                const pipY = 720 - pipH - 24;
                const radius = 12;

                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                ctx.shadowBlur = 16;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 4;

                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(pipX, pipY, pipW, pipH, radius);
                else ctx.rect(pipX, pipY, pipW, pipH);
                ctx.clip();

                if (cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0) {
                    ctx.save();
                    ctx.translate(pipX + pipW, pipY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(cameraVideo, 0, 0, pipW, pipH);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#18284C';
                    ctx.fillRect(pipX, pipY, pipW, pipH);
                }
                ctx.restore();

                // PiP border
                ctx.save();
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(pipX, pipY, pipW, pipH, radius);
                else ctx.rect(pipX, pipY, pipW, pipH);
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#3B82F6';
                ctx.stroke();
                ctx.restore();

                // 4. Proctor badge (Top-Left)
                ctx.save();
                ctx.fillStyle = 'rgba(11, 19, 43, 0.85)';
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(24, 24, 220, 32, 6);
                else ctx.rect(24, 24, 220, 32);
                ctx.fill();

                ctx.fillStyle = '#EF4444';
                ctx.beginPath();
                ctx.arc(38, 40, 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#F8FAFC';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('PROCTORED SCREEN + CAM', 50, 44);
                ctx.restore();

                pipAnimationIdRef.current = requestAnimationFrame(drawPipFrame);
            };
            pipAnimationIdRef.current = requestAnimationFrame(drawPipFrame);

            // STEP 6: Capture canvas video stream & combine with mixed audio
            const canvasStream = canvas.captureStream(25);
            const pipVideoTrack = canvasStream.getVideoTracks()[0];

            const combinedStream = new MediaStream();
            if (pipVideoTrack) combinedStream.addTrack(pipVideoTrack);
            mixDestination.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

            combinedStreamRef.current = combinedStream;

            // STEP 7: Initialize MediaRecorder
            let mimeType = 'video/webm';
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
                const candidates = [
                    'video/webm;codecs=vp8,opus',
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8',
                    'video/webm',
                ];
                for (const candidate of candidates) {
                    if (MediaRecorder.isTypeSupported(candidate)) {
                        mimeType = candidate;
                        break;
                    }
                }
            }

            recordedChunksRef.current = [];
            const recorder = new MediaRecorder(combinedStream, {
                mimeType,
                videoBitsPerSecond: 1200000,
                audioBitsPerSecond: 128000,
            });

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current = recorder;
            setRecordingStatus('ready');

            // Set up MutationObserver to catch Daily <audio> elements
            if (audioObserverRef.current) audioObserverRef.current.disconnect();
            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (node.nodeName === 'AUDIO') {
                            setTimeout(() => scanAndConnectVapiAudio(), 50);
                            setTimeout(() => scanAndConnectVapiAudio(), 300);
                        }
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            audioObserverRef.current = observer;

            return true;
        } catch (setupErr) {
            console.error('Screen/camera/mic setup failed:', setupErr);
            throw setupErr;
        }
    };

    /**
     * Start the live interview session (Screen 4)
     */
    const startInterview = async () => {
        if (!vapiInstance || !interview) return;

        setError(null);
        setUploadError(null);
        setScreenWarning(false);
        setCallStatus('connecting');
        vapiCallStartedRef.current = false;
        isUploadingRef.current = false;

        try {
            await startCameraAndRecorder();

            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen().catch(() => {});
                    logIntegrityEvent('fullscreen_entered');
                }
            } catch (fsErr) {}

            attachIntegrityListeners();
            logIntegrityEvent('interview_started');

            console.log('Starting VAPI call with assistant ID:', interview.vapi_config.assistantId);
            await vapiInstance.start(interview.vapi_config.assistantId?.trim(), interview.vapi_config.assistantOverrides);

            try {
                if (vapiInstance.call && typeof vapiInstance.call.on === 'function') {
                    vapiInstance.call.on('track-started', (e) => {
                        if (e?.track && e.track.kind === 'audio') {
                            const isLocal = !!e?.participant?.local;
                            connectStreamOrTrackToMix(e.track, isLocal ? 'Candidate Mic (Daily)' : 'Assistant Voice (Daily)');
                        }
                    });
                }
            } catch (callErr) {}

            scanAndConnectVapiAudio();
        } catch (err) {
            console.error('Error starting interview flow:', err);
            cleanupAllMedia();
            removeIntegrityListeners();
            setError(err.message || 'Failed to start screen/camera or interview. Please try again.');
            setCallStatus('idle');
            setRecordingStatus('idle');
        }
    };

    /**
     * Safely stop MediaRecorder, construct binary Blob, and upload.
     */
    const stopRecordingAndUpload = async () => {
        if (isUploadingRef.current) return;
        isUploadingRef.current = true;

        logIntegrityEvent('recording_stopped');
        setRecordingStatus('uploading');

        const recorder = mediaRecorderRef.current;
        const doUploadAndCleanup = async () => {
            // Stop Vapi call AFTER recorder has stopped and collected final chunks
            if (vapiInstance && vapiCallStartedRef.current) {
                try { vapiInstance.stop(); } catch (e) {}
            }

            const chunks = recordedChunksRef.current;
            const interviewId = interview?.interview?.id;
            const mimeType = recorder?.mimeType || 'video/webm';
            const blob = new Blob(chunks, { type: mimeType });

            console.log("Final chunks count:", chunks.length);
            console.log("Final video+audio blob size:", blob.size, "bytes");

            if (blob.size === 0) {
                setRecordingStatus('error');
                setUploadError("Recorded video blob is empty.");
                cleanupAllMedia();
                removeIntegrityListeners();
                return;
            }

            if (interviewId) {
                try {
                    const videoStartedMs = videoRecordingStartTimestampRef.current;
                    const vapiStartedMs = vapiCallStartTimestampRef.current;

                    const integritySummary = {
                        recording_type: 'screen_pip_av',
                        screen_recording_enabled: true,
                        vapi_audio_in_recording: vapiAudioConnectedRef.current,
                        tab_switch_count: integrityCounts.tabSwitchCount,
                        window_blur_count: integrityCounts.windowBlurCount,
                        fullscreen_exit_count: integrityCounts.fullscreenExitCount,
                        camera_interruption_count: integrityCounts.cameraInterruptionCount,
                        screen_interruption_count: integrityCounts.screenInterruptionCount || 0,
                        video_recording_started_at_ms: videoStartedMs,
                        vapi_call_started_at_ms: vapiStartedMs,
                        events: integrityEventsRef.current,
                    };

                    console.log(`Uploading combined A/V recording (${blob.size} bytes) for interview ${interviewId}`);
                    await interviewAPI.uploadRecording(interviewId, blob, integritySummary);
                    setRecordingStatus('uploaded');
                    console.log('✅ Combined video+audio recording uploaded successfully!');
                } catch (upErr) {
                    console.error('Video upload failed:', upErr);
                    setRecordingStatus('error');
                    setUploadError(`Interview completed, but video upload failed (${upErr.message || 'Server error'}).`);
                }
            }

            cleanupAllMedia();
            removeIntegrityListeners();
        };

        if (recorder && recorder.state !== 'inactive') {
            recorder.onstop = doUploadAndCleanup;
            recorder.stop();
        } else {
            await doUploadAndCleanup();
        }
    };

    const endInterview = () => {
        setCallStatus('ended');
        stopRecordingAndUpload();
    };

    const toggleMute = () => {
        if (vapiInstance) {
            vapiInstance.setMuted(!isMuted);
            setIsMuted(!isMuted);
        }
    };

    // Category & Persona Derivation
    const category = interview?.interview?.category || 'scholarship';
    const roleName = interview?.interview?.role || 'Interview';
    const isHR = category === 'hr' || roleName.toLowerCase().includes('hr') || roleName.toLowerCase().includes('screening');
    const isScholarship = !isHR && (category === 'scholarship' || roleName.toLowerCase().includes('scholarship') || roleName.toLowerCase().includes('fulbright'));
    const isTechnical = !isHR && !isScholarship && (category === 'tech' || roleName.toLowerCase().includes('engineer') || roleName.toLowerCase().includes('developer'));
    
    const categoryTitle = isHR
        ? 'General HR Screening Interview'
        : isScholarship 
            ? 'Scholarship Interview' 
            : isTechnical 
                ? 'Technical Assessment' 
                : `${roleName} Interview`;

    const assistantTitle = isHR
        ? 'HR Interviewer'
        : isScholarship 
            ? 'AI Scholarship Interviewer' 
            : isTechnical 
                ? 'AI Technical Interviewer' 
                : 'AI Interviewer';

    const formatTimer = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // =========================================================================
    // SCREEN 1: CANDIDATE ACCESS / LOGIN SCREEN
    // =========================================================================
    if (!passwordVerified) {
        const hasUrlId = !!uniqueId;

        return (
            <div className="page" style={{ padding: '2.5rem 1rem', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
                <div className="container" style={{ maxWidth: '980px', margin: '0 auto' }}>
                    <div className="cm-auth-grid">
                        {/* Left Hero Branded Panel */}
                        <div className="cm-auth-hero">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                    <div className="cm-brand-logo">
                                        <Sparkles size={24} color="#3B82F6" />
                                        <span>CandiMind</span>
                                    </div>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: 'var(--radius-full)',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#60A5FA',
                                        border: '1px solid rgba(59, 130, 246, 0.3)'
                                    }}>
                                        Proctored v4.0
                                    </span>
                                </div>

                                <h1 style={{ fontSize: '2.15rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '0.85rem', letterSpacing: '-0.025em', color: '#F8FAFC' }}>
                                    AI-Powered Candidate Assessment
                                </h1>
                                <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '400px' }}>
                                    A seamless, conversational evaluation platform powered by intelligent voice AI with real-time proctoring and unbiased scoring.
                                </p>
                            </div>

                            <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: 'var(--cm-text-secondary)', fontSize: '0.86rem' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                                        <ShieldCheck size={16} color="#10B981" />
                                    </div>
                                    <div>
                                        <strong style={{ color: '#F1F5F9', display: 'block', fontSize: '0.88rem' }}>Isolated & Encrypted Session</strong>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--cm-text-tertiary)' }}>Single-use authenticated access with end-to-end data privacy.</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: 'var(--cm-text-secondary)', fontSize: '0.86rem' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                                        <Sparkles size={16} color="#3B82F6" />
                                    </div>
                                    <div>
                                        <strong style={{ color: '#F1F5F9', display: 'block', fontSize: '0.88rem' }}>Adaptive Conversational AI</strong>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--cm-text-tertiary)' }}>Natural, spoken dialogue that dynamically adjusts to your responses.</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: 'var(--cm-text-secondary)', fontSize: '0.86rem' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(130, 156, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                                        <Video size={16} color="#829CFF" />
                                    </div>
                                    <div>
                                        <strong style={{ color: '#F1F5F9', display: 'block', fontSize: '0.88rem' }}>Verified Integrity Proctoring</strong>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--cm-text-tertiary)' }}>Webcam, microphone, and screen share monitoring for fairness.</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--cm-text-tertiary)' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }} />
                                <span>Voice AI & Assessment Engine Operational</span>
                            </div>
                        </div>

                        {/* Right Login Form Panel */}
                        <div className="cm-auth-form" style={{ padding: '2.5rem' }}>
                            <div style={{ marginBottom: '1.75rem' }}>
                                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.35rem', color: '#F8FAFC' }}>
                                    Candidate Sign-In
                                </h2>
                                <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.9rem' }}>
                                    Enter your interview session details to begin your assessment.
                                </p>
                            </div>

                            <form onSubmit={handlePasswordSubmit}>
                                {/* Interview ID or Link Input */}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cm-text-primary)' }}>
                                            Interview ID or Invitation Link
                                        </label>
                                        {hasUrlId && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--cm-status-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <CheckCircle2 size={13} /> Link Detected
                                            </span>
                                        )}
                                    </div>
                                    <div className="cm-input-wrapper" style={{ marginBottom: '0.35rem' }}>
                                        <Link2 size={18} className="cm-input-icon" color="#3B82F6" />
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Paste interview link or enter ID (e.g. cand-abc-123)"
                                            value={enteredId}
                                            onChange={(e) => setEnteredId(e.target.value)}
                                            disabled={verifying}
                                            required
                                            style={{ fontSize: '0.9rem' }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--cm-text-tertiary)' }}>
                                        Accepts full URL link or session ID provided by your hiring team.
                                    </div>
                                </div>

                                {/* Password Input with Show/Hide Toggle */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cm-text-primary)' }}>
                                            Access Password
                                        </label>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--cm-text-tertiary)' }}>
                                            6-character code
                                        </span>
                                    </div>
                                    <div className="cm-input-wrapper" style={{ marginBottom: '0.35rem' }}>
                                        <Key size={18} className="cm-input-icon" color="#3B82F6" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            className="input has-toggle"
                                            placeholder="Enter 6-character password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value.toUpperCase())}
                                            disabled={verifying}
                                            autoFocus={hasUrlId}
                                            required
                                            maxLength={20}
                                            style={{ letterSpacing: '0.15em', fontWeight: 700, fontFamily: 'monospace', fontSize: '1rem' }}
                                        />
                                        <button
                                            type="button"
                                            className="cm-input-toggle"
                                            onClick={() => setShowPassword(!showPassword)}
                                            tabIndex={-1}
                                            title={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--cm-text-tertiary)' }}>
                                        Case-insensitive passcode received in your invitation.
                                    </div>
                                </div>

                                {passwordError && (
                                    <div className="alert alert-error mb-base" style={{ padding: '0.75rem 1rem', fontSize: '0.86rem' }}>
                                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                                        <span>{passwordError}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={verifying || !password.trim() || !enteredId.trim()}
                                    style={{ width: '100%', padding: '0.9rem', fontSize: '0.98rem', fontWeight: 700, marginTop: '0.5rem' }}
                                >
                                    {verifying ? (
                                        <>
                                            <Loader size={18} className="spinner" />
                                            Verifying Credentials...
                                        </>
                                    ) : (
                                        <>
                                            Continue to System Setup
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Collapsible Requirements / Tips */}
                            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--cm-border-subtle)' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowRequirementsTip(!showRequirementsTip)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--cm-text-secondary)',
                                        fontSize: '0.82rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        width: '100%',
                                        cursor: 'pointer',
                                        padding: '0.2rem 0'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                        <Info size={15} color="#3B82F6" />
                                        Pre-Interview Requirements & Tips
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--cm-text-tertiary)' }}>
                                        {showRequirementsTip ? 'Hide' : 'Show'}
                                    </span>
                                </button>

                                {showRequirementsTip && (
                                    <div style={{ marginTop: '0.75rem', background: 'var(--cm-bg-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--cm-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CheckCircle2 size={14} color="#10B981" />
                                            <span><strong>Browser:</strong> Latest Google Chrome, Microsoft Edge, or Brave</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CheckCircle2 size={14} color="#10B981" />
                                            <span><strong>Hardware:</strong> Functioning webcam, microphone, and headphones</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CheckCircle2 size={14} color="#10B981" />
                                            <span><strong>Permissions:</strong> Allow screen sharing and media access when prompted</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CheckCircle2 size={14} color="#10B981" />
                                            <span><strong>Environment:</strong> Quiet, well-lit room with minimal distractions</span>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--cm-text-tertiary)' }}>
                                    Are you an administrator or interviewer?{' '}
                                    <a href="/admin" style={{ color: 'var(--cm-accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
                                        Admin Console →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="page" style={{ alignItems: 'center' }}>
                <div className="card text-center" style={{ padding: '3rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1.5rem', width: '48px', height: '48px' }} />
                    <h3>Loading your interview session...</h3>
                    <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.88rem' }}>Preparing voice assistant and proctoring parameters.</p>
                </div>
            </div>
        );
    }

    if (error && !interview) {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '600px' }}>
                    <div className="alert alert-error">
                        <AlertCircle size={22} style={{ flexShrink: 0 }} />
                        <div>
                            <strong>Session Error:</strong> {error}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // SCREEN 5: INTERVIEW COMPLETION & FINALIZATION SCREEN
    // =========================================================================
    if (callStatus === 'ended') {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '640px' }}>
                    <div className="card cm-completion-card">
                        <div className="cm-success-circle">
                            <CheckCircle2 size={42} />
                        </div>

                        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                            Interview Completed!
                        </h1>
                        <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.95rem' }}>
                            Thank you for participating in the <strong>{roleName}</strong> evaluation.
                        </p>

                        <div className="cm-finalization-list">
                            <div className="cm-finalization-item">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle2 size={16} color="#10B981" /> Interview conversation ended
                                </span>
                                <span style={{ color: 'var(--cm-text-tertiary)' }}>{formatTimer(callDurationSeconds)}</span>
                            </div>
                            <div className="cm-finalization-item">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle2 size={16} color="#10B981" /> Media streams finalized
                                </span>
                                <span style={{ color: 'var(--cm-status-success)' }}>Saved</span>
                            </div>
                            <div className="cm-finalization-item">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {recordingStatus === 'uploaded' ? (
                                        <CheckCircle2 size={16} color="#10B981" />
                                    ) : (
                                        <Loader size={16} className="spinner" color="#3B82F6" />
                                    )}
                                    Uploading screen & audio recording
                                </span>
                                <span style={{ color: recordingStatus === 'uploaded' ? 'var(--cm-status-success)' : 'var(--cm-accent-primary)' }}>
                                    {recordingStatus === 'uploaded' ? '100%' : 'In progress...'}
                                </span>
                            </div>
                            <div className="cm-finalization-item">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle2 size={16} color="#10B981" /> Proctoring integrity log sealed
                                </span>
                                <span style={{ color: 'var(--cm-status-success)' }}>Verified</span>
                            </div>
                            <div className="cm-finalization-item">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle2 size={16} color="#10B981" /> Submission received by committee
                                </span>
                                <span style={{ color: 'var(--cm-status-success)' }}>Ready</span>
                            </div>
                        </div>

                        {uploadError && (
                            <div className="alert alert-error" style={{ textAlign: 'left' }}>
                                <AlertCircle size={18} />
                                <span>{uploadError}</span>
                            </div>
                        )}

                        <p style={{ color: 'var(--cm-text-tertiary)', fontSize: '0.85rem', marginBottom: '1.75rem' }}>
                            You may now close this browser window. Your interview has been securely transmitted.
                        </p>

                        <button
                            onClick={() => window.location.reload()}
                            className="btn btn-secondary"
                            style={{ margin: '0 auto' }}
                        >
                            Return to Access Screen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // SCREEN 2: WELCOME & INSTRUCTIONS SCREEN
    // =========================================================================
    if (onboardingStep === 'welcome' && callStatus === 'idle') {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '980px' }}>
                    {/* Stepper Header */}
                    <div className="cm-stepper">
                        <div className="cm-step-item active">
                            <div className="cm-step-num">1</div>
                            <span className="cm-step-label">Welcome</span>
                        </div>
                        <div className="cm-step-line" />
                        <div className="cm-step-item">
                            <div className="cm-step-num">2</div>
                            <span className="cm-step-label">Setup</span>
                        </div>
                        <div className="cm-step-line" />
                        <div className="cm-step-item">
                            <div className="cm-step-num">3</div>
                            <span className="cm-step-label">Interview</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.5rem' }}>
                        {/* Left Card: Welcome & Metadata */}
                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '1.75rem' }}>👋</span>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                    Welcome, {interview?.interview?.candidate_name}
                                </h2>
                            </div>
                            <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
                                You are about to start your <strong>{roleName}</strong> interview.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--cm-bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cm-border-subtle)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <Sparkles size={18} color="#3B82F6" style={{ marginTop: '2px' }} />
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--cm-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Format</div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>Real-Time Voice AI Interview</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <UserCheck size={18} color="#06B6D4" style={{ marginTop: '2px' }} />
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--cm-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Interviewer</div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{assistantTitle}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <Monitor size={18} color="#10B981" style={{ marginTop: '2px' }} />
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--cm-text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Recording</div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>Audio + Video + Full Screen Proctored</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Card: Before You Begin Checklist */}
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>
                                    Before you begin
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem', color: 'var(--cm-text-secondary)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <CheckCircle2 size={16} color="#10B981" />
                                        <span>Use a quiet and well-lit environment</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <CheckCircle2 size={16} color="#10B981" />
                                        <span>Ensure a stable internet connection</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <CheckCircle2 size={16} color="#10B981" />
                                        <span>Use a desktop or laptop with Chrome or Edge</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <CheckCircle2 size={16} color="#10B981" />
                                        <span>Allow camera, microphone and screen share access</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <CheckCircle2 size={16} color="#10B981" />
                                        <span>Answer questions naturally and authentically</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setOnboardingStep('setup');
                                    startHardwarePreFlight();
                                }}
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '1.5rem', padding: '0.85rem' }}
                            >
                                Continue to Setup
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // SCREEN 3: DEVICE & PERMISSION SETUP SCREEN
    // =========================================================================
    if (onboardingStep === 'setup' && callStatus === 'idle') {
        const canStartInterview = setupCamReady && setupMicReady && setupScreenReady;

        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '1080px' }}>
                    {/* Stepper Header */}
                    <div className="cm-stepper">
                        <div className="cm-step-item completed">
                            <div className="cm-step-num">✓</div>
                            <span className="cm-step-label">Welcome</span>
                        </div>
                        <div className="cm-step-line completed" />
                        <div className="cm-step-item active">
                            <div className="cm-step-num">2</div>
                            <span className="cm-step-label">Setup</span>
                        </div>
                        <div className="cm-step-line" />
                        <div className="cm-step-item">
                            <div className="cm-step-num">3</div>
                            <span className="cm-step-label">Interview</span>
                        </div>
                    </div>

                    <div className="text-center mb-xl">
                        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                            Let's check your equipment
                        </h1>
                        <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.92rem' }}>
                            Make sure your camera, microphone, and screen sharing are active before the session starts.
                        </p>
                    </div>

                    {error && (
                        <div className="alert alert-error mb-lg">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* 3 Hardware Cards Grid */}
                    <div className="cm-device-grid">
                        {/* 1. Camera Card */}
                        <div className={`cm-device-card ${setupCamReady ? 'ready' : ''}`}>
                            <div className="cm-device-card-header">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <Video size={16} color="#3B82F6" /> Camera
                                </span>
                                <span className={`cm-status-pill ${setupCamReady ? 'ready' : 'pending'}`}>
                                    {setupCamReady ? 'Camera ready' : 'Detecting...'}
                                </span>
                            </div>
                            <div className="cm-device-preview-box">
                                <video
                                    ref={setupVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                                />
                                {!setupCamReady && (
                                    <div style={{ color: 'var(--cm-text-tertiary)', fontSize: '0.8rem' }}>
                                        Camera Preview
                                    </div>
                                )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--cm-text-secondary)', marginTop: 'auto' }}>
                                {camDeviceName}
                            </div>
                        </div>

                        {/* 2. Microphone Card */}
                        <div className={`cm-device-card ${setupMicReady ? 'ready' : ''}`}>
                            <div className="cm-device-card-header">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <Mic size={16} color="#3B82F6" /> Microphone
                                </span>
                                <span className={`cm-status-pill ${setupMicReady ? 'ready' : 'pending'}`}>
                                    {setupMicReady ? 'Microphone ready' : 'Detecting...'}
                                </span>
                            </div>
                            <div className="cm-device-preview-box" style={{ flexDirection: 'column', padding: '1rem' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--cm-text-secondary)', marginBottom: '0.5rem' }}>
                                    Speak to test microphone activity:
                                </div>
                                <div className="cm-vu-meter">
                                    {[...Array(10)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={`cm-vu-bar ${i < micVolumeLevel ? (i > 7 ? 'active-high' : 'active') : ''}`}
                                            style={{ height: `${Math.max(4, (i + 1) * 3.5)}px` }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--cm-text-secondary)', marginTop: 'auto' }}>
                                {micDeviceName}
                            </div>
                        </div>

                        {/* 3. Screen Sharing Card */}
                        <div className={`cm-device-card ${setupScreenReady ? 'ready' : ''}`}>
                            <div className="cm-device-card-header">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <Monitor size={16} color="#3B82F6" /> Screen Sharing
                                </span>
                                <span className={`cm-status-pill ${setupScreenReady ? 'ready' : 'danger'}`}>
                                    {setupScreenReady ? 'Screen ready' : 'Required'}
                                </span>
                            </div>
                            <div className="cm-device-preview-box" style={{ flexDirection: 'column', padding: '1rem', textAlign: 'center' }}>
                                {setupScreenReady ? (
                                    <>
                                        <CheckCircle2 size={36} color="#10B981" style={{ marginBottom: '0.5rem' }} />
                                        <span style={{ fontSize: '0.85rem', color: '#10B981', fontWeight: 600 }}>Entire Screen Shared</span>
                                    </>
                                ) : (
                                    <>
                                        <Monitor size={32} color="#64748B" style={{ marginBottom: '0.5rem' }} />
                                        <button
                                            onClick={authorizeScreenShareInSetup}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
                                        >
                                            Share Entire Screen
                                        </button>
                                    </>
                                )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--cm-text-secondary)', marginTop: 'auto' }}>
                                {setupScreenReady ? 'Screen stream captured ✓' : 'Select "Entire Screen" in browser prompt'}
                            </div>
                        </div>
                    </div>

                    {/* Speaker Test Bar */}
                    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Volume2 size={20} color="#3B82F6" />
                            <div>
                                <strong style={{ fontSize: '0.92rem' }}>Speaker & Headphone Test</strong>
                                <p style={{ fontSize: '0.8rem', color: 'var(--cm-text-secondary)', margin: 0 }}>
                                    Play a test chime to verify you can clearly hear the AI interviewer.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={playTestAudio}
                            disabled={audioTestPlaying}
                            className="btn btn-secondary"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        >
                            {audioTestPlaying ? 'Playing Sound...' : 'Play Test Sound'}
                        </button>
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button
                            onClick={() => setOnboardingStep('welcome')}
                            className="btn btn-secondary"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => {
                                setOnboardingStep('interview');
                                startInterview();
                            }}
                            disabled={!canStartInterview}
                            className="btn btn-primary"
                            style={{ padding: '0.85rem 2rem', fontSize: '1.05rem' }}
                        >
                            Start Interview
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // SCREEN 4: LIVE AI INTERVIEW ROOM (70/30 ASYMMETRIC LAYOUT)
    // =========================================================================
    return (
        <div className="cm-interview-layout">
            {/* Top Navigation Header */}
            <header className="cm-interview-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="cm-brand-logo">
                        <Sparkles size={22} color="#3B82F6" />
                        <span>CandiMind</span>
                    </div>
                    <div style={{ height: '18px', width: '1px', background: 'var(--cm-border-medium)' }} />
                    <span className="cm-brand-badge">{categoryTitle}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--cm-status-success)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cm-status-success)' }} />
                        {callStatus === 'active' ? 'Connected' : 'Connecting...'}
                    </div>

                    {recordingStatus === 'recording' && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            background: 'var(--cm-status-danger-bg)',
                            color: 'var(--cm-status-danger)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            padding: '0.25rem 0.65rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.82rem',
                            fontWeight: 700
                        }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cm-status-danger)', animation: 'pulse 1s infinite' }} />
                            REC {formatTimer(callDurationSeconds)}
                        </div>
                    )}

                    <button
                        onClick={endInterview}
                        className="btn btn-danger"
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                    >
                        <PhoneOff size={16} />
                        End Interview
                    </button>
                </div>
            </header>

            {/* Main Stage Grid (70% AI / 30% Proctor) */}
            <main className="cm-interview-stage">
                {/* LEFT: AI Interviewer Area (70%) */}
                <div className="cm-ai-stage">
                    {/* Disruption Alert Banner */}
                    {screenWarning && (
                        <div className="alert alert-error" style={{ width: '100%', marginBottom: '1rem' }}>
                            <AlertCircle size={20} />
                            <span>Screen sharing interrupted. Please keep your entire screen shared throughout the interview.</span>
                        </div>
                    )}

                    {/* AI Avatar Centerpiece */}
                    <div className="cm-ai-avatar-container">
                        {isAssistantSpeaking && <div className="cm-ai-glow" />}
                        {isAssistantSpeaking && <div className="cm-ai-speaking-ring" />}
                        <img
                            src="/interviewer-avatar.jpg"
                            alt="AI Interviewer"
                            className="cm-ai-avatar-img"
                            style={{
                                borderColor: isAssistantSpeaking ? '#3B82F6' : 'var(--cm-border-strong)'
                            }}
                        />
                    </div>

                    <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                        {assistantTitle}
                    </h2>

                    {/* Speaking Activity Status Indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        {isAssistantSpeaking ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '14px' }}>
                                    <span className="soundwave-bar" style={{ animationDelay: '0s' }} />
                                    <span className="soundwave-bar" style={{ animationDelay: '0.2s' }} />
                                    <span className="soundwave-bar" style={{ animationDelay: '0.4s' }} />
                                    <span className="soundwave-bar" style={{ animationDelay: '0.1s' }} />
                                </div>
                                <span style={{ fontSize: '0.82rem', color: '#60A5FA', fontWeight: 600 }}>Speaking...</span>
                            </>
                        ) : (
                            <span style={{ fontSize: '0.82rem', color: 'var(--cm-text-tertiary)' }}>Listening to you...</span>
                        )}
                    </div>

                    {/* Current Question / Live Transcript Card */}
                    <div className="cm-question-card">
                        <div style={{ fontSize: '0.75rem', color: 'var(--cm-text-tertiary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
                            Current Question
                        </div>
                        <p style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--cm-text-primary)', margin: 0 }}>
                            {assistantMessage || "Listening to candidate..."}
                        </p>
                    </div>
                </div>

                {/* RIGHT: Candidate Proctor Panel (30%) */}
                <div className="cm-proctor-panel">
                    {/* Webcam Mirrored Preview */}
                    <div className="cm-proctor-card">
                        <div className="cm-proctor-card-header">
                            <span>Your Camera</span>
                            <span className="cm-status-pill ready">● Live</span>
                        </div>
                        <div className="cm-proctor-video-wrap">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                            />
                        </div>
                    </div>

                    {/* Screen Sharing Proctor Preview */}
                    <div className="cm-proctor-card">
                        <div className="cm-proctor-card-header">
                            <span>Shared Screen</span>
                            <span className={`cm-status-pill ${screenActive ? 'ready' : 'danger'}`}>
                                {screenActive ? '● Recording' : 'Paused'}
                            </span>
                        </div>
                        <div className="cm-proctor-video-wrap" style={{ background: '#0F172A', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <Monitor size={32} color={screenActive ? "#3B82F6" : "#EF4444"} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--cm-text-secondary)' }}>
                                {screenActive ? 'Full Screen Stream Active' : 'Screen Share Stopped'}
                            </span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Floating Control Bar */}
            <footer className="cm-controls-bar">
                <button
                    onClick={toggleMute}
                    className={`btn ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ minWidth: '130px' }}
                >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    {isMuted ? 'Muted' : 'Microphone'}
                </button>

                <div style={{ height: '24px', width: '1px', background: 'var(--cm-border-subtle)' }} />

                <button
                    onClick={endInterview}
                    className="btn btn-danger"
                    style={{ padding: '0.75rem 1.75rem' }}
                >
                    <PhoneOff size={18} />
                    End Interview
                </button>
            </footer>
        </div>
    );
}
