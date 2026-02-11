import React, { useState, useEffect } from 'react';
import { interviewAPI } from '../services/api';
import { Copy, Check, Plus, Filter, Trash2, RefreshCw } from 'lucide-react';

export default function HRDashboard() {
    // Password authentication state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [checkingAuth, setCheckingAuth] = useState(true);

    const HR_PASSWORD = '#Candimind@2026';

    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // {id, name}
    const [fetchingResults, setFetchingResults] = useState({}); // {interviewId: true/false}

    // Form state
    const [formData, setFormData] = useState({
        candidateName: '',
        candidateEmail: '',
        role: 'frontend'
    });
    const [createdInterview, setCreatedInterview] = useState(null);

    // Filter state
    const [filters, setFilters] = useState({
        role: '',
        status: ''
    });

    // Check if already authenticated on mount
    useEffect(() => {
        const authToken = localStorage.getItem('hr_auth');
        if (authToken === HR_PASSWORD) {
            setIsAuthenticated(true);
        }
        setCheckingAuth(false);
    }, []);

    // Handle password verification
    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (passwordInput === HR_PASSWORD) {
            localStorage.setItem('hr_auth', HR_PASSWORD);
            setIsAuthenticated(true);
            setPasswordError('');
        } else {
            setPasswordError('Incorrect password. Please try again.');
            setPasswordInput('');
        }
    };

    // Handle logout
    const handleLogout = () => {
        localStorage.removeItem('hr_auth');
        setIsAuthenticated(false);
        setPasswordInput('');
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchInterviews();
        }
    }, [filters, isAuthenticated]);

    const fetchInterviews = async () => {
        setLoading(true);
        try {
            const data = await interviewAPI.listInterviews(filters);
            setInterviews(data);
        } catch (error) {
            console.error('Error fetching interviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const interview = await interviewAPI.createInterview(
                formData.candidateName,
                formData.candidateEmail,
                formData.role
            );

            setCreatedInterview(interview);
            setFormData({ candidateName: '', candidateEmail: '', role: 'frontend' });
            setShowForm(false);
            fetchInterviews();
        } catch (error) {
            console.error('Error creating interview:', error);
            alert('Failed to create interview. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (link, id) => {
        navigator.clipboard.writeText(link);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = async (interviewId) => {
        setLoading(true);
        try {
            await interviewAPI.deleteInterview(interviewId);
            setDeleteConfirm(null);
            fetchInterviews();
        } catch (error) {
            console.error('Error deleting interview:', error);
            alert('Failed to delete interview. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFetchResults = async (interviewId) => {
        setFetchingResults(prev => ({ ...prev, [interviewId]: true }));
        try {
            await interviewAPI.fetchResults(interviewId);
            fetchInterviews(); // Refresh to show results
        } catch (error) {
            console.error('Error fetching results:', error);
            const message = error.response?.data?.detail || 'Failed to fetch results. Please try again.';
            alert(message);
        } finally {
            setFetchingResults(prev => ({ ...prev, [interviewId]: false }));
        }
    };

    // Show loading while checking authentication
    if (checkingAuth) {
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

    // Show password screen if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="page">
                <div className="container">
                    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                        <div className="card card-glass text-center">
                            <h1 className="page-title" style={{ marginBottom: 'var(--spacing-md)' }}>
                                🔐 HR Dashboard Access
                            </h1>
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-xl)' }}>
                                Please enter the admin password to access the HR Dashboard.
                            </p>
                            <form onSubmit={handlePasswordSubmit}>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Enter admin password"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    style={{
                                        width: '100%',
                                        marginBottom: 'var(--spacing-md)',
                                        textAlign: 'center',
                                        fontSize: '1.25rem'
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
                                    style={{ width: '100%' }}
                                >
                                    Login
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div className="flex-between">
                        <div>
                            <h1 className="page-title">AI Interview Platform</h1>
                            <p className="page-subtitle">Create and manage AI-powered technical interviews</p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={handleLogout}
                                style={{ padding: '0.75rem 1.5rem' }}
                            >
                                Logout
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowForm(!showForm)}
                            >
                                <Plus size={20} />
                                New Interview
                            </button>
                        </div>
                    </div>
                </div>

                {/* Created Interview Success Message */}
                {createdInterview && (
                    <div className="alert alert-success mb-lg">
                        <strong>Interview created successfully!</strong>
                        <p style={{ marginTop: 'var(--spacing-sm)', color: 'var(--color-text-muted)' }}>
                            📧 Email both the link AND password to the candidate
                        </p>
                        <div className="mt-sm">
                            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                                <strong>Interview Link:</strong>
                            </div>
                            <div className="flex gap-sm" style={{ alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                                <code style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    flex: 1,
                                    fontSize: '0.875rem'
                                }}>
                                    {createdInterview.interview_link}
                                </code>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => copyToClipboard(createdInterview.interview_link, createdInterview.id)}
                                >
                                    {copiedId === createdInterview.id ? <Check size={16} /> : <Copy size={16} />}
                                    {copiedId === createdInterview.id ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            {createdInterview.access_password && (
                                <>
                                    <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                                        <strong>Access Password:</strong>
                                    </div>
                                    <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                                        <code style={{
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: '0.5rem',
                                            borderRadius: 'var(--radius-sm)',
                                            flex: 1,
                                            fontSize: '1.25rem',
                                            letterSpacing: '0.1em',
                                            fontWeight: 'bold',
                                            color: 'var(--color-success)'
                                        }}>
                                            {createdInterview.access_password}
                                        </code>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => copyToClipboard(createdInterview.access_password, `pwd-${createdInterview.id}`)}
                                        >
                                            {copiedId === `pwd-${createdInterview.id}` ? <Check size={16} /> : <Copy size={16} />}
                                            {copiedId === `pwd-${createdInterview.id}` ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Create Interview Form */}
                {showForm && (
                    <div className="card card-glass mb-xl">
                        <h2 style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.5rem' }}>
                            Create Interview Link
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Candidate Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="John Doe"
                                    value={formData.candidateName}
                                    onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Candidate Email</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="john.doe@example.com"
                                    value={formData.candidateEmail}
                                    onChange={(e) => setFormData({ ...formData, candidateEmail: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <select
                                    className="form-select"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    required
                                >
                                    <option value="frontend">Frontend (React Native)</option>
                                    <option value="backend">Backend (TypeScript)</option>
                                </select>
                            </div>

                            <div className="flex gap-md">
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Creating...' : 'Generate Interview Link'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowForm(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filters */}
                <div className="card mb-lg" style={{ padding: 'var(--spacing-md)' }}>
                    <div className="flex gap-md" style={{ alignItems: 'center' }}>
                        <Filter size={20} />
                        <select
                            className="form-select"
                            style={{ width: 'auto' }}
                            value={filters.role}
                            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                        >
                            <option value="">All Roles</option>
                            <option value="frontend">Frontend</option>
                            <option value="backend">Backend</option>
                        </select>
                        <select
                            className="form-select"
                            style={{ width: 'auto' }}
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </div>

                {/* Interviews List */}
                {loading && interviews.length === 0 ? (
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Candidate</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {interviews.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center" style={{ padding: 'var(--spacing-xl)' }}>
                                            No interviews found. Create your first interview link!
                                        </td>
                                    </tr>
                                ) : (
                                    interviews.map((interview) => (
                                        <tr key={interview.id}>
                                            <td>
                                                <strong>{interview.candidate_name}</strong>
                                                {interview.result && (
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
                                                        ✓ Interview completed
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>{interview.candidate_email}</td>
                                            <td>
                                                <span className={`badge badge-${interview.role}`}>
                                                    {interview.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${interview.status}`}>
                                                    {interview.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>
                                                {new Date(interview.created_at).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <div className="flex gap-sm">
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                        onClick={() => copyToClipboard(interview.interview_link, interview.id)}
                                                    >
                                                        {copiedId === interview.id ? <Check size={16} /> : <Copy size={16} />}
                                                    </button>
                                                    {interview.status === 'completed' && interview.result ? (
                                                        <ViewResultButton result={interview.result} />
                                                    ) : interview.status === 'in_progress' ? (
                                                        <button
                                                            className="btn"
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                fontSize: '0.875rem',
                                                                background: 'var(--color-warning)',
                                                                color: 'white',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem'
                                                            }}
                                                            onClick={() => handleFetchResults(interview.id)}
                                                            disabled={fetchingResults[interview.id]}
                                                        >
                                                            <RefreshCw size={16} style={{
                                                                animation: fetchingResults[interview.id] ? 'spin 1s linear infinite' : 'none'
                                                            }} />
                                                            {fetchingResults[interview.id] ? 'Fetching...' : 'Fetch Results'}
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        className="btn"
                                                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--color-danger)', color: 'white' }}
                                                        onClick={() => setDeleteConfirm({ id: interview.id, name: interview.candidate_name })}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <>
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 0, 0, 0.7)',
                                zIndex: 999,
                                backdropFilter: 'blur(4px)'
                            }}
                            onClick={() => setDeleteConfirm(null)}
                        />
                        <div
                            style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-xl)',
                                maxWidth: '500px',
                                width: '90%',
                                zIndex: 1000,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
                            }}
                        >
                            <h2 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-danger)' }}>
                                Delete Interview
                            </h2>
                            <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-muted)' }}>
                                Are you sure you want to delete the interview for <strong>{deleteConfirm.name}</strong>?
                                This will permanently remove the interview and all associated results.
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setDeleteConfirm(null)}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn"
                                    style={{ background: 'var(--color-danger)', color: 'white' }}
                                    onClick={() => handleDelete(deleteConfirm.id)}
                                    disabled={loading}
                                >
                                    {loading ? 'Deleting...' : 'Delete Interview'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Component to view interview results
function ViewResultButton({ result }) {
    const [showModal, setShowModal] = useState(false);




    function cleanTranscript(transcript) {
        if (!transcript) return '';

        // Find first real dialogue marker
        const botIndex = transcript.indexOf('BOT:');
        const userIndex = transcript.indexOf('USER:');

        // pick the earliest valid one (BOT or USER)
        const startIndexCandidates = [botIndex, userIndex].filter(i => i !== -1);
        if (startIndexCandidates.length === 0) return transcript; // fallback

        const startIndex = Math.min(...startIndexCandidates);
        return transcript.slice(startIndex).trim();
    }

    if (!showModal) {
        return (
            <button
                className="btn btn-success"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                onClick={() => setShowModal(true)}
            >
                View Results
            </button>
        );
    }

    return (
        <>
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: 'var(--spacing-lg)'
                }}
                onClick={() => setShowModal(false)}
            >
                <div
                    className="card"
                    style={{
                        maxWidth: '800px',
                        width: '100%',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Interview Results</h2>

                    {result.evaluation && (
                        <div className="mb-lg">
                            <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.125rem' }}>Evaluation</h3>

                            {/* Recommendation Badge */}
                            {result.evaluation.overall_recommendation && (
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '0.5rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '1.125rem',
                                        fontWeight: 'bold',
                                        background: result.evaluation.overall_recommendation === 'No Hire'
                                            ? 'var(--color-error)'
                                            : result.evaluation.overall_recommendation === 'Strong Hire'
                                                ? 'var(--color-success)'
                                                : 'var(--color-warning)',
                                        color: 'white'
                                    }}>
                                        {result.evaluation.overall_recommendation}
                                    </span>
                                </div>
                            )}

                            {/* Scores Table */}
                            <table className="table" style={{ marginBottom: 'var(--spacing-md)' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '60%' }}>Criteria</th>
                                        <th style={{ width: '40%', textAlign: 'center' }}>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.evaluation.overall_score !== undefined && (
                                        <tr style={{ background: 'var(--color-surface-elevated)', fontWeight: 'bold' }}>
                                            <td>Overall Score</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.25rem', color: 'var(--color-primary)' }}>
                                                {result.evaluation.overall_score}/10
                                            </td>
                                        </tr>
                                    )}
                                    {result.evaluation.communication_clarity !== undefined && (
                                        <tr>
                                            <td>Communication Clarity</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.125rem' }}>
                                                {result.evaluation.communication_clarity}/10
                                            </td>
                                        </tr>
                                    )}
                                    {result.evaluation.culture_fit_ownership !== undefined && (
                                        <tr>
                                            <td>Culture Fit & Ownership</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.125rem' }}>
                                                {result.evaluation.culture_fit_ownership}/10
                                            </td>
                                        </tr>
                                    )}
                                    {result.evaluation.react_native_technical_depth !== undefined && (
                                        <tr>
                                            <td>React Native Technical Depth</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.125rem' }}>
                                                {result.evaluation.react_native_technical_depth}/10
                                            </td>
                                        </tr>
                                    )}
                                    {result.evaluation.mobile_engineering_experience !== undefined && (
                                        <tr>
                                            <td>Mobile Engineering Experience</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.125rem' }}>
                                                {result.evaluation.mobile_engineering_experience}/10
                                            </td>
                                        </tr>
                                    )}
                                    {result.evaluation.backend_technical_depth !== undefined && (
                                        <tr>
                                            <td>Backend Technical Depth</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.125rem' }}>
                                                {result.evaluation.backend_technical_depth}/10
                                            </td>
                                        </tr>
                                    )}
                                    {result.evaluation.system_design_ability !== undefined && (
                                        <tr>
                                            <td>System Design Ability</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.125rem' }}>
                                                {result.evaluation.system_design_ability}/10
                                            </td>
                                        </tr>
                                    )}
                                    {result.evaluation.backend_technical_depth !== undefined && (
                                        <tr>
                                            <td>Backend Technical Depth</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.125rem' }}>
                                                {result.evaluation.backend_technical_depth}/10
                                            </td>
                                        </tr>
                                    )}
                                    {result.evaluation.system_design_ability !== undefined && (
                                        <tr>
                                            <td>System Design Ability</td>
                                            <td style={{ textAlign: 'center', fontSize: '1.125rem' }}>
                                                {result.evaluation.system_design_ability}/10
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Summary */}
                            {result.evaluation.summary && (
                                <p style={{ marginTop: 'var(--spacing-md)', padding: 'var(--spacing-sm)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                                    {result.evaluation.summary}
                                </p>
                            )}

                            {/* Key Strengths */}
                            {result.evaluation.key_strengths && result.evaluation.key_strengths.length > 0 && (
                                <div style={{ marginTop: 'var(--spacing-md)' }}>
                                    <strong style={{ color: 'var(--color-success)' }}>✓ Key Strengths:</strong>
                                    <ul style={{ marginTop: 'var(--spacing-xs)', marginLeft: 'var(--spacing-lg)' }}>
                                        {result.evaluation.key_strengths.map((strength, idx) => (
                                            <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>{strength}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Key Concerns */}
                            {result.evaluation.key_concerns && result.evaluation.key_concerns.length > 0 && (
                                <div style={{ marginTop: 'var(--spacing-md)' }}>
                                    <strong style={{ color: 'var(--color-error)' }}>⚠ Key Concerns:</strong>
                                    <ul style={{ marginTop: 'var(--spacing-xs)', marginLeft: 'var(--spacing-lg)' }}>
                                        {result.evaluation.key_concerns.map((concern, idx) => (
                                            <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>{concern}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {result.summary && !result.evaluation?.summary && (
                        <div className="mb-lg">
                            <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.125rem' }}>Summary</h3>
                            <p style={{ color: 'var(--color-text-muted)' }}>{result.summary}</p>
                        </div>
                    )}

                    {result.transcript && (
                        <div className="mb-lg">
                            <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.125rem' }}>Transcript</h3>
                            <div style={{
                                background: 'var(--color-surface-elevated)',
                                padding: 'var(--spacing-md)',
                                borderRadius: 'var(--radius-md)',
                                maxHeight: '300px',
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                fontSize: '0.875rem',
                                lineHeight: 1.6
                            }}>
                                {cleanTranscript(result.transcript)}

                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-secondary mt-lg"
                        onClick={() => setShowModal(false)}
                    >
                        Close
                    </button>
                </div>
            </div>
        </>
    );
}
