import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Vapi from '@vapi-ai/web';
import { interviewAPI } from '../services/api';
import { Mic, MicOff, Phone, PhoneOff, Loader } from 'lucide-react';

export default function CandidateInterview() {
    const { uniqueId } = useParams();
    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Password verification state
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [verifying, setVerifying] = useState(false);

    // VAPI state
    const [vapiInstance, setVapiInstance] = useState(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, active, ended
    const [assistantMessage, setAssistantMessage] = useState('');

    // Load interview data only after password is verified
    useEffect(() => {
        if (passwordVerified) {
            loadInterview();
        }
    }, [passwordVerified, uniqueId]);

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setVerifying(true);
        setPasswordError('');

        try {
            const result = await interviewAPI.verifyPassword(uniqueId, password);

            if (result.valid) {
                setPasswordVerified(true);
            } else {
                setPasswordError('Invalid password. Please check your email and try again.');
            }
        } catch (error) {
            console.error('Error verifying password:', error);
            setPasswordError('Failed to verify password. Please try again.');
        } finally {
            setVerifying(false);
        }
    };

    const loadInterview = async () => {
        setLoading(true);
        try {
            const data = await interviewAPI.getInterviewByUID(uniqueId);
            setInterview(data);

            // Initialize VAPI with public key
            const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
            if (!publicKey) {
                throw new Error('VAPI public key not configured');
            }
            const vapi = new Vapi(publicKey);
            setVapiInstance(vapi);

            // Set up VAPI event listeners
            vapi.on('call-start', () => {
                console.log('Call started');
                setIsCallActive(true);
                setCallStatus('active');
            });

            vapi.on('call-end', () => {
                console.log('Call ended');
                setIsCallActive(false);
                setCallStatus('ended');
            });

            vapi.on('speech-start', () => {
                console.log('Assistant started speaking');
            });

            vapi.on('speech-end', () => {
                console.log('Assistant stopped speaking');
            });

            vapi.on('message', (message) => {
                console.log('Message:', message);
                if (message.type === 'transcript' && message.role === 'assistant') {
                    setAssistantMessage(message.transcript);
                }
            });

            vapi.on('error', (error) => {
                console.error('VAPI Error:', error);
                setError('An error occurred during the interview. Please refresh and try again.');
            });

        } catch (err) {
            console.error('Error loading interview:', err);
            setError('Interview not found or has expired.');
        } finally {
            setLoading(false);
        }
    };

    const startInterview = async () => {
        if (!vapiInstance || !interview) return;

        setCallStatus('connecting');
        console.log('Starting interview with config:', interview.vapi_config);

        try {
            console.log('Calling vapi.start() with assistant ID:', interview.vapi_config.assistantId);
            // Start the VAPI call with just the assistant ID
            // Note: Assistant customization (like first message) should be configured in VAPI dashboard
            await vapiInstance.start(interview.vapi_config.assistantId);
            console.log('VAPI start() call completed successfully');
        } catch (err) {
            console.error('Error starting call:', err);
            console.error('Error details:', JSON.stringify(err, null, 2));
            setError(`Failed to start interview. ${err.message || 'Please check your microphone and try again.'}`);
            setCallStatus('idle');
        }
    };

    const endInterview = () => {
        if (vapiInstance) {
            vapiInstance.stop();
        }
    };

    const toggleMute = () => {
        if (vapiInstance) {
            vapiInstance.setMuted(!isMuted);
            setIsMuted(!isMuted);
        }
    };

    // Show password entry screen if not verified
    if (!passwordVerified) {
        return (
            <div className="page">
                <div className="container">
                    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                        <div className="card card-glass text-center">
                            <h1 className="page-title" style={{ marginBottom: 'var(--spacing-md)' }}>
                                🔐 Password Required
                            </h1>
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-xl)' }}>
                                Please enter the password that was emailed to you to access your interview.
                            </p>
                            <form onSubmit={handlePasswordSubmit}>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Enter password (e.g., A7X9K2)"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value.toUpperCase())}
                                    disabled={verifying}
                                    style={{
                                        width: '100%',
                                        marginBottom: 'var(--spacing-md)',
                                        textAlign: 'center',
                                        fontSize: '1.5rem',
                                        letterSpacing: '0.2em',
                                        fontWeight: 'bold'
                                    }}
                                    autoFocus
                                    required
                                />
                                {passwordError && (
                                    <div className="alert alert-error" style={{ marginBottom: 'var(--spacing-md)', textAlign: 'left' }}>
                                        {passwordError}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={verifying || !password}
                                    style={{ width: '100%' }}
                                >
                                    {verifying ? (
                                        <>
                                            <Loader size={20} className="spinner" />
                                            Verifying...
                                        </>
                                    ) : (
                                        'Access Interview'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <div className="container">
                    <div className="alert alert-error">
                        <strong>Error:</strong> {error}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>

                    {/* Welcome Screen */}
                    {callStatus === 'idle' && (
                        <div className="card card-glass text-center">
                            <h1 className="page-title" style={{ marginBottom: 'var(--spacing-md)' }}>
                                Welcome to Your AI Interview
                            </h1>

                            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                                <p style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-md)' }}>
                                    Hello, <strong>{interview.interview.candidate_name}</strong>!
                                </p>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                    You're about to begin your AI-powered interview for the
                                </p>
                                <span className={`badge badge-${interview.interview.role}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                                    {interview.interview.role === 'frontend' ? 'Frontend React Native Developer' : 'Backend TypeScript Developer'}
                                </span>
                                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--spacing-lg)' }}>
                                    This is a voice-based interview. Please ensure you're in a quiet environment
                                    with a good internet connection. The interview will take approximately 20-25 minutes.
                                </p>
                            </div>

                            <div className="alert alert-info mb-lg">
                                <strong>Before you start:</strong>
                                <ul style={{ textAlign: 'left', marginTop: 'var(--spacing-sm)', marginLeft: 'var(--spacing-lg)' }}>
                                    <li>Make sure your microphone is working</li>
                                    <li>Find a quiet place without interruptions</li>
                                    <li>Speak clearly and take your time to answer</li>
                                    <li>This interview will be recorded for review</li>
                                </ul>
                            </div>

                            <button
                                className="btn btn-primary"
                                style={{ fontSize: '1.125rem', padding: '1rem 2rem' }}
                                onClick={startInterview}
                            >
                                <Phone size={24} />
                                Start Interview
                            </button>
                        </div>
                    )}

                    {/* Connecting State */}
                    {callStatus === 'connecting' && (
                        <div className="card card-glass text-center">
                            <div style={{ padding: 'var(--spacing-2xl)' }}>
                                <Loader size={48} style={{
                                    color: 'var(--color-primary)',
                                    animation: 'spin 1s linear infinite',
                                    margin: '0 auto var(--spacing-lg)'
                                }} />
                                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Connecting...</h2>
                                <p style={{ color: 'var(--color-text-muted)' }}>
                                    Please wait while we connect you with the AI interviewer
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Active Interview */}
                    {callStatus === 'active' && (
                        <div className="card card-glass">
                            <div className="text-center" style={{ marginBottom: 'var(--spacing-xl)' }}>
                                <div style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                                    margin: '0 auto var(--spacing-lg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    animation: isCallActive ? 'pulse 2s infinite' : 'none'
                                }}>
                                    <Mic size={48} color="white" />
                                </div>

                                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Interview in Progress</h2>
                                <span className={`badge badge-${interview.interview.role}`} style={{ fontSize: '1rem' }}>
                                    {interview.interview.role === 'frontend' ? 'Frontend React Native' : 'Backend TypeScript'}
                                </span>
                            </div>

                            {/* Assistant Message Display */}
                            {assistantMessage && (
                                <div style={{
                                    background: 'var(--color-surface-elevated)',
                                    padding: 'var(--spacing-lg)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--spacing-xl)',
                                    minHeight: '100px'
                                }}>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-xs)' }}>
                                        Interviewer:
                                    </p>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>{assistantMessage}</p>
                                </div>
                            )}

                            {/* Controls */}
                            <div className="flex gap-md" style={{ justifyContent: 'center' }}>
                                <button
                                    className={`btn ${isMuted ? 'btn-error' : 'btn-secondary'}`}
                                    onClick={toggleMute}
                                >
                                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                                    {isMuted ? 'Unmute' : 'Mute'}
                                </button>
                                <button
                                    className="btn btn-error"
                                    onClick={endInterview}
                                >
                                    <PhoneOff size={20} />
                                    End Interview
                                </button>
                            </div>

                            <p style={{
                                textAlign: 'center',
                                color: 'var(--color-text-muted)',
                                fontSize: '0.875rem',
                                marginTop: 'var(--spacing-lg)'
                            }}>
                                The AI interviewer can see and hear you. Speak naturally and clearly.
                            </p>
                        </div>
                    )}

                    {/* Interview Ended */}
                    {callStatus === 'ended' && (
                        <div className="card card-glass text-center">
                            <div style={{ padding: 'var(--spacing-xl)' }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    background: 'var(--color-success)',
                                    margin: '0 auto var(--spacing-lg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>

                                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Interview Completed</h2>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '1.125rem' }}>
                                    Thank you for completing the interview, <strong>{interview.interview.candidate_name}</strong>!
                                </p>
                                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--spacing-md)' }}>
                                    Your responses have been recorded and will be reviewed by our team.
                                    We'll be in touch soon with the next steps.
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.7);
          }
          50% {
            box-shadow: 0 0 0 20px rgba(124, 58, 237, 0);
          }
        }
      `}</style>
        </div>
    );
}
