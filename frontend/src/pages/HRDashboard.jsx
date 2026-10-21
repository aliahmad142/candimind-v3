import React, { useState, useEffect } from 'react';
import { interviewAPI } from '../services/api';
import { 
    Copy, Check, Plus, Filter, Trash2, RefreshCw, LayoutDashboard, 
    Users, Video, FileText, Settings, ShieldCheck, Download, 
    ChevronRight, ArrowLeft, Play, ExternalLink, Sparkles, CheckCircle2,
    Clock, AlertCircle, Eye, Search
} from 'lucide-react';

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
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [fetchingResults, setFetchingResults] = useState({});
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'interviews' | 'results'
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInterviewResult, setSelectedInterviewResult] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'scholarship' | 'hr'

    // Form state (supports generic categories!)
    const [formData, setFormData] = useState({
        candidateName: '',
        candidateEmail: '',
        category: 'scholarship',
        role: 'Fulbright Masters'
    });
    const [createdInterview, setCreatedInterview] = useState(null);

    // Filter state
    const [filters, setFilters] = useState({
        role: '',
        status: ''
    });

    useEffect(() => {
        const authToken = localStorage.getItem('hr_auth');
        if (authToken === HR_PASSWORD) {
            setIsAuthenticated(true);
        }
        setCheckingAuth(false);
    }, []);

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
                formData.role,
                formData.category
            );

            setCreatedInterview(interview);
            setFormData({
                candidateName: '',
                candidateEmail: '',
                category: formData.category,
                role: formData.category === 'hr' ? 'General HR Screening' : 'Fulbright Masters'
            });
            // Keep showForm open so modal displays the generated link and passcode
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
            fetchInterviews();
        } catch (error) {
            console.error('Error fetching results:', error);
            const message = error.response?.data?.detail || 'Failed to fetch results. Please try again.';
            alert(message);
        } finally {
            setFetchingResults(prev => ({ ...prev, [interviewId]: false }));
        }
    };

    // Metrics calculations for dashboard overview
    const totalApplicants = interviews.length;
    const completedCount = interviews.filter(i => i.status === 'completed').length;
    const inProgressCount = interviews.filter(i => i.status === 'in_progress').length;
    const pendingCount = interviews.filter(i => i.status === 'pending').length;
    const scholarshipCount = interviews.filter(i => (i.category || 'scholarship') !== 'hr' && !i.role?.toLowerCase().includes('hr')).length;
    const hrCount = interviews.filter(i => i.category === 'hr' || i.role?.toLowerCase().includes('hr')).length;

    // Filtered interviews list
    const filteredInterviews = interviews.filter(i => {
        if (categoryFilter !== 'all') {
            const cat = (i.category || 'scholarship').toLowerCase();
            const isHR = cat === 'hr' || (i.role && i.role.toLowerCase().includes('hr'));
            if (categoryFilter === 'hr' && !isHR) return false;
            if (categoryFilter === 'scholarship' && isHR) return false;
        }
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            i.candidate_name?.toLowerCase().includes(q) ||
            i.candidate_email?.toLowerCase().includes(q) ||
            i.role?.toLowerCase().includes(q)
        );
    });

    if (checkingAuth) {
        return (
            <div className="page" style={{ alignItems: 'center' }}>
                <div className="spinner" style={{ width: '48px', height: '48px' }} />
            </div>
        );
    }

    // Login Screen for Admin Dashboard
    if (!isAuthenticated) {
        return (
            <div className="page" style={{ padding: '2rem 1rem' }}>
                <div className="container" style={{ maxWidth: '440px' }}>
                    <div className="card text-center" style={{ padding: '2.5rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'var(--cm-accent-soft)',
                            color: 'var(--cm-accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.25rem'
                        }}>
                            <ShieldCheck size={28} />
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                            Admin Dashboard Access
                        </h1>
                        <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.88rem', marginBottom: '1.75rem' }}>
                            Enter the administrative password to manage CandiMind interview sessions.
                        </p>

                        <form onSubmit={handlePasswordSubmit}>
                            <input
                                type="password"
                                className="input no-icon"
                                placeholder="Enter admin password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                style={{ textAlign: 'center', marginBottom: '1rem', letterSpacing: '0.1em' }}
                                autoFocus
                                required
                            />
                            {passwordError && (
                                <div className="alert alert-error mb-md" style={{ textAlign: 'left', fontSize: '0.85rem' }}>
                                    <AlertCircle size={16} />
                                    <span>{passwordError}</span>
                                </div>
                            )}
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '0.8rem' }}
                            >
                                Login to Dashboard
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cm-bg-base)' }}>
            {/* Sidebar Navigation (Screen 6 Mockup) */}
            <aside style={{
                width: '240px',
                background: 'var(--cm-bg-surface)',
                borderRight: '1px solid var(--cm-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0
            }}>
                {/* Brand */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--cm-border-subtle)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Sparkles size={22} color="#3B82F6" />
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>CandiMind</span>
                </div>

                {/* Nav Links */}
                <nav style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                    <button
                        onClick={() => { setActiveTab('overview'); setSelectedInterviewResult(null); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: activeTab === 'overview' ? 'var(--cm-accent-soft)' : 'transparent',
                            color: activeTab === 'overview' ? 'var(--cm-accent-primary)' : 'var(--cm-text-secondary)',
                            fontWeight: activeTab === 'overview' ? 600 : 500,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                    >
                        <LayoutDashboard size={18} />
                        Overview
                    </button>

                    <button
                        onClick={() => { setActiveTab('interviews'); setSelectedInterviewResult(null); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: activeTab === 'interviews' ? 'var(--cm-accent-soft)' : 'transparent',
                            color: activeTab === 'interviews' ? 'var(--cm-accent-primary)' : 'var(--cm-text-secondary)',
                            fontWeight: activeTab === 'interviews' ? 600 : 500,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                    >
                        <Users size={18} />
                        Applicants & Interviews
                    </button>

                    <button
                        onClick={() => setShowForm(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--cm-text-secondary)',
                            fontWeight: 500,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                    >
                        <Plus size={18} />
                        Create Interview
                    </button>
                </nav>

                {/* Footer / Logout */}
                <div style={{ padding: '1rem', borderTop: '1px solid var(--cm-border-subtle)' }}>
                    <button
                        onClick={handleLogout}
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '0.55rem', fontSize: '0.85rem' }}
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
                {/* Top Bar */}
                <header style={{
                    height: '64px',
                    borderBottom: '1px solid var(--cm-border-subtle)',
                    padding: '0 2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--cm-bg-surface)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700 }}>Admin Console</span>
                        <span className="cm-brand-badge">Multi-Category v4.0</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn btn-primary"
                            style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}
                        >
                            <Plus size={16} />
                            Create Interview
                        </button>
                    </div>
                </header>

                <main style={{ padding: '2rem', flex: 1 }}>
                    {/* View Specific Modal/Screen: Detailed Results (Screen 7) */}
                    {selectedInterviewResult ? (
                        <InterviewResultsDetailView
                            interview={selectedInterviewResult}
                            onBack={() => setSelectedInterviewResult(null)}
                        />
                    ) : (
                        <>
                            {/* Dashboard Overview Header */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                                    Dashboard Overview
                                </h1>
                                <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.92rem' }}>
                                    Manage AI-powered interviews, applicants, recordings, and evaluations.
                                </p>
                            </div>

                            {/* 4 Metric Cards (Screen 6 Mockup) */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '1rem',
                                marginBottom: '2rem'
                            }}>
                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--cm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                        Total Applicants
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--cm-accent-primary)' }}>
                                        {totalApplicants}
                                    </div>
                                </div>

                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--cm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                        Completed
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--cm-status-success)' }}>
                                        {completedCount}
                                    </div>
                                </div>

                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--cm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                        In Progress
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--cm-status-warning)' }}>
                                        {inProgressCount}
                                    </div>
                                </div>

                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--cm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                        Pending
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--cm-text-primary)' }}>
                                        {pendingCount}
                                    </div>
                                </div>
                            </div>

                            {/* Newly Created Interview Notification Banner */}
                            {createdInterview && (
                                <div className="alert alert-info mb-xl" style={{ display: 'block', padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 700, fontSize: '1.05rem', color: '#67E8F9' }}>
                                        <CheckCircle2 size={20} />
                                        Interview Created Successfully!
                                    </div>
                                    <p style={{ fontSize: '0.88rem', color: 'var(--cm-text-secondary)', marginBottom: '0.75rem' }}>
                                        Share the link and access password with the candidate:
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <input
                                            type="text"
                                            readOnly
                                            className="input no-icon"
                                            value={createdInterview.interview_link}
                                            style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                        />
                                        <button
                                            onClick={() => copyToClipboard(createdInterview.interview_link, 'new-link')}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                        >
                                            {copiedId === 'new-link' ? <Check size={16} /> : <Copy size={16} />}
                                            {copiedId === 'new-link' ? 'Copied' : 'Copy Link'}
                                        </button>
                                    </div>
                                    {createdInterview.access_password && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                            <span>Password:</span>
                                            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 700, color: '#F8FAFC' }}>
                                                {createdInterview.access_password}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(createdInterview.access_password, 'new-pwd')}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                                            >
                                                {copiedId === 'new-pwd' ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Create Interview Modal Dialog */}
                            {showForm && (
                                <div style={{
                                    position: 'fixed',
                                    inset: 0,
                                    background: 'rgba(0, 0, 0, 0.75)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 9999,
                                    padding: '1.5rem'
                                }}>
                                    <div className="card" style={{ maxWidth: '560px', width: '100%', border: '1px solid var(--cm-border-medium)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}>
                                        {createdInterview ? (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <CheckCircle2 size={20} color="#10B981" />
                                                        </div>
                                                        <div>
                                                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                                                                Interview Link Ready!
                                                            </h2>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--cm-text-secondary)' }}>
                                                                Configured for <strong>{createdInterview.candidate_name || 'Candidate'}</strong>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setShowForm(false);
                                                            setCreatedInterview(null);
                                                        }}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>

                                                <div style={{ background: 'var(--cm-bg-elevated)', border: '1px solid var(--cm-border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                                                    <div style={{ marginBottom: '1rem' }}>
                                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--cm-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                                            Candidate Interview Link
                                                        </label>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                className="input no-icon"
                                                                value={createdInterview.interview_link}
                                                                style={{ flex: 1, padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                                                            />
                                                            <button
                                                                onClick={() => copyToClipboard(createdInterview.interview_link, 'modal-link')}
                                                                className="btn btn-secondary"
                                                                style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                                                            >
                                                                {copiedId === 'modal-link' ? <Check size={16} color="#10B981" /> : <Copy size={16} />}
                                                                {copiedId === 'modal-link' ? 'Copied' : 'Copy'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {createdInterview.access_password && (
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--cm-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                                                Access Password (6-Character Passcode)
                                                            </label>
                                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                <div style={{
                                                                    flex: 1,
                                                                    background: 'rgba(0, 0, 0, 0.4)',
                                                                    border: '1px solid var(--cm-border-medium)',
                                                                    borderRadius: 'var(--radius-md)',
                                                                    padding: '0.55rem 0.85rem',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '1.15rem',
                                                                    fontWeight: 800,
                                                                    letterSpacing: '0.2em',
                                                                    color: '#60A5FA'
                                                                }}>
                                                                    {createdInterview.access_password}
                                                                </div>
                                                                <button
                                                                    onClick={() => copyToClipboard(createdInterview.access_password, 'modal-pwd')}
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                                                                >
                                                                    {copiedId === 'modal-pwd' ? <Check size={16} color="#10B981" /> : <Copy size={16} />}
                                                                    {copiedId === 'modal-pwd' ? 'Copied' : 'Copy'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <a
                                                        href={createdInterview.interview_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-secondary"
                                                        style={{ fontSize: '0.85rem', gap: '0.45rem' }}
                                                    >
                                                        Open Candidate Portal <ExternalLink size={14} />
                                                    </a>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => setCreatedInterview(null)}
                                                            className="btn btn-secondary"
                                                            style={{ fontSize: '0.85rem' }}
                                                        >
                                                            Create Another
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setShowForm(false);
                                                                setCreatedInterview(null);
                                                            }}
                                                            className="btn btn-primary"
                                                            style={{ fontSize: '0.85rem' }}
                                                        >
                                                            Done
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                                        Create AI Interview Session
                                                    </h2>
                                                    <button
                                                        onClick={() => setShowForm(false)}
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>

                                                <form onSubmit={handleSubmit}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                                                Candidate Full Name
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="input no-icon"
                                                                placeholder="e.g. Sarah Khan"
                                                                value={formData.candidateName}
                                                                onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                                                                required
                                                                autoFocus
                                                            />
                                                        </div>

                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                                                Candidate Email
                                                            </label>
                                                            <input
                                                                type="email"
                                                                className="input no-icon"
                                                                placeholder="candidate@example.com"
                                                                value={formData.candidateEmail}
                                                                onChange={(e) => setFormData({ ...formData, candidateEmail: e.target.value })}
                                                                required
                                                            />
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                                                Interview Category
                                                            </label>
                                                            <select
                                                                className="form-select"
                                                                value={formData.category}
                                                                onChange={(e) => {
                                                                    const cat = e.target.value;
                                                                    let defaultRole = cat === 'hr' ? 'General HR Screening' : 'Fulbright Masters';
                                                                    setFormData({ ...formData, category: cat, role: defaultRole });
                                                                }}
                                                            >
                                                                <option value="scholarship">🎓 Scholarship & Academic</option>
                                                                <option value="hr">👥 General HR Screening</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                                                                {formData.category === 'hr' ? 'Interview Title / Focus' : 'Scholarship Program'}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="input no-icon"
                                                                placeholder={formData.category === 'hr' ? 'e.g. General HR Screening' : 'e.g. Fulbright Masters'}
                                                                value={formData.role}
                                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                                required
                                                            />
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowForm(false)}
                                                            className="btn btn-secondary"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            className="btn btn-primary"
                                                            disabled={loading}
                                                        >
                                                            {loading ? 'Creating Session...' : 'Generate Interview Link'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Search and Category Filter Bar */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '1rem',
                                marginBottom: '1.25rem',
                                flexWrap: 'wrap'
                            }}>
                                {/* Category Segmented Tabs */}
                                <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--cm-bg-surface)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--cm-border-subtle)' }}>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryFilter('all')}
                                        style={{
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '0.45rem 0.85rem',
                                            fontSize: '0.82rem',
                                            fontWeight: categoryFilter === 'all' ? 700 : 500,
                                            background: categoryFilter === 'all' ? 'var(--cm-accent-primary)' : 'transparent',
                                            color: categoryFilter === 'all' ? '#fff' : 'var(--cm-text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        All Interviews ({totalApplicants})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryFilter('scholarship')}
                                        style={{
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '0.45rem 0.85rem',
                                            fontSize: '0.82rem',
                                            fontWeight: categoryFilter === 'scholarship' ? 700 : 500,
                                            background: categoryFilter === 'scholarship' ? 'var(--cm-accent-primary)' : 'transparent',
                                            color: categoryFilter === 'scholarship' ? '#fff' : 'var(--cm-text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        🎓 Scholarship ({scholarshipCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCategoryFilter('hr')}
                                        style={{
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '0.45rem 0.85rem',
                                            fontSize: '0.82rem',
                                            fontWeight: categoryFilter === 'hr' ? 700 : 500,
                                            background: categoryFilter === 'hr' ? 'var(--cm-accent-primary)' : 'transparent',
                                            color: categoryFilter === 'hr' ? '#fff' : 'var(--cm-text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        👥 HR Screening ({hrCount})
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', width: '280px' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--cm-text-tertiary)' }} />
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Search applicants..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            style={{ padding: '0.55rem 0.85rem 0.55rem 2.4rem', fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    <select
                                        className="form-select"
                                        style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                        value={filters.status}
                                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>

                            {/* Recent Interviews Table (Screen 6 Mockup) */}
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table className="table" style={{ margin: 0 }}>
                                    <thead>
                                        <tr>
                                            <th>Applicant</th>
                                            <th>Email</th>
                                            <th>Category & Role</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInterviews.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--cm-text-secondary)' }}>
                                                    No interviews found matching your criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredInterviews.map((interview) => (
                                                <tr key={interview.id}>
                                                    <td>
                                                        <strong style={{ display: 'block', fontSize: '0.92rem' }}>{interview.candidate_name}</strong>
                                                        {interview.result && (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--cm-status-success)' }}>
                                                                ● Evaluated
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ color: 'var(--cm-text-secondary)', fontSize: '0.85rem' }}>
                                                        {interview.candidate_email}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                                            {interview.category === 'hr' || (interview.role && interview.role.toLowerCase().includes('hr')) ? (
                                                                <span style={{
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 700,
                                                                    padding: '0.15rem 0.5rem',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    background: 'rgba(6, 182, 212, 0.15)',
                                                                    color: '#22D3EE',
                                                                    border: '1px solid rgba(6, 182, 212, 0.3)'
                                                                }}>
                                                                    👥 HR
                                                                </span>
                                                            ) : (
                                                                <span style={{
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 700,
                                                                    padding: '0.15rem 0.5rem',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    background: 'rgba(99, 102, 241, 0.15)',
                                                                    color: '#818CF8',
                                                                    border: '1px solid rgba(99, 102, 241, 0.3)'
                                                                }}>
                                                                    🎓 Scholarship
                                                                </span>
                                                            )}
                                                            <span style={{ fontSize: '0.85rem', color: 'var(--cm-text-primary)' }}>
                                                                {interview.role}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge badge-${interview.status}`}>
                                                            {interview.status.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: 'var(--cm-text-secondary)', fontSize: '0.85rem' }}>
                                                        {new Date(interview.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                                                            {interview.status === 'completed' && interview.result ? (
                                                                <button
                                                                    className="btn btn-primary"
                                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                                    onClick={() => setSelectedInterviewResult(interview)}
                                                                >
                                                                    <Eye size={14} />
                                                                    View
                                                                </button>
                                                            ) : interview.status === 'in_progress' ? (
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                                    onClick={() => handleFetchResults(interview.id)}
                                                                    disabled={fetchingResults[interview.id]}
                                                                >
                                                                    <RefreshCw size={14} className={fetchingResults[interview.id] ? 'spinner' : ''} />
                                                                    Fetch
                                                                </button>
                                                            ) : null}

                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '0.35rem 0.65rem' }}
                                                                onClick={() => copyToClipboard(interview.interview_link, interview.id)}
                                                                title="Copy Interview Link"
                                                            >
                                                                {copiedId === interview.id ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                                                            </button>

                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '0.35rem 0.65rem', color: 'var(--cm-status-danger)' }}
                                                                onClick={() => setDeleteConfirm({ id: interview.id, name: interview.candidate_name })}
                                                                title="Delete Interview"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="card" style={{ maxWidth: '440px', width: '90%' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--cm-status-danger)' }}>
                            Delete Interview
                        </h3>
                        <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            Are you sure you want to delete the interview for <strong>{deleteConfirm.name}</strong>? All associated recordings and transcripts will be permanently removed.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm.id)}
                                className="btn btn-danger"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Screen 7: Detailed Interview Results & Synchronized Video Playback Modal
 */
function InterviewResultsDetailView({ interview, onBack }) {
    const [activeTab, setActiveTab] = useState('evaluation'); // 'evaluation' | 'transcript'
    const result = interview?.result || {};

    const getVideoUrl = (path) => {
        if (!path) return null;
        if (typeof path === 'string' && path.includes('/uploads/interviews/')) {
            const rel = path.substring(path.indexOf('/uploads/interviews/'));
            const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
            return `${base}${rel}`;
        }
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        return `${base}${path.startsWith('/') ? path : `/${path}`}`;
    };

    const videoUrl = getVideoUrl(result.merged_video_url || result.recording_url);

    // Extraction of evaluation fields
    const evalData = result.evaluation || {};

    const isHR = (interview?.category === 'hr') || 
                 (interview?.role && interview.role.toLowerCase().includes('hr')) || 
                 (evalData.review_status !== undefined) || 
                 (evalData.interview_summary !== undefined) ||
                 (evalData.communication !== undefined && evalData.academic_background === undefined);

    // HR Competencies definition matching the Vapi structured output
    const hrCompetencies = [
        { key: 'communication', label: 'Communication Clarity', desc: 'Explains ideas clearly, coherently, and relevantly.' },
        { key: 'background_experience', label: 'Background & Experience', desc: 'Explains educational & professional experiences and achievements.' },
        { key: 'problem_solving', label: 'Problem-Solving', desc: 'Identifies challenges, reasoning, decisions, and reflection on outcomes.' },
        { key: 'teamwork', label: 'Teamwork & Collaboration', desc: 'Cooperation with others, shared goals, and resolving disagreements.' },
        { key: 'self_awareness', label: 'Self-Awareness & Growth', desc: 'Recognizes strengths, development areas, and responds to feedback.' },
        { key: 'adaptability', label: 'Adaptability & Learning', desc: 'Demonstrates flexibility, learning new skills, and continuous improvement.' },
        { key: 'career_motivation', label: 'Career Motivation & Goals', desc: 'Clarity and realism of professional interests and career direction.' },
    ];

    // Compute average score across assessed numerical dimensions
    const assessedHRScores = hrCompetencies
        .map(c => evalData[c.key])
        .filter(val => typeof val === 'number' && !isNaN(val));
    const hrAverageScore = assessedHRScores.length > 0
        ? (assessedHRScores.reduce((sum, s) => sum + s, 0) / assessedHRScores.length).toFixed(1)
        : null;

    const scholarshipOverallScore = evalData.overall_score || (evalData.academic_background ? (
        ((evalData.academic_background || 8) + (evalData.motivation || 9) + (evalData.leadership || 8)) / 3
    ).toFixed(1) : '8.5');

    return (
        <div>
            {/* Header Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <button
                    onClick={onBack}
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
                >
                    <ArrowLeft size={16} />
                    Back to Interviews
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isHR ? (
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.65rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(6, 182, 212, 0.15)',
                            color: '#22D3EE',
                            border: '1px solid rgba(6, 182, 212, 0.3)'
                        }}>
                            👥 General HR Screening
                        </span>
                    ) : (
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.65rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#818CF8',
                            border: '1px solid rgba(99, 102, 241, 0.3)'
                        }}>
                            🎓 Scholarship Interview
                        </span>
                    )}
                    <span className="cm-brand-badge">{interview.role}</span>
                    <span className="badge badge-completed">Completed</span>
                </div>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                Interview Results — {interview.candidate_name}
            </h1>
            <p style={{ color: 'var(--cm-text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Review the recorded interview, transcription, and AI-generated assessment.
            </p>

            {/* Split Review Layout (Screen 7 Mockup) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left Side: Video Player Container */}
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Video size={18} color="#3B82F6" />
                            Session Recording
                        </h3>
                        {result.integrity_summary?.screen_recording_enabled && (
                            <span className="cm-status-pill ready">Screen + Cam PiP</span>
                        )}
                    </div>

                    {videoUrl ? (
                        <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000', marginBottom: '1rem' }}>
                            <video
                                key={videoUrl}
                                controls
                                preload="metadata"
                                src={videoUrl}
                                style={{ width: '100%', maxHeight: '420px', display: 'block' }}
                            />
                        </div>
                    ) : (
                        <div style={{ height: '240px', background: 'var(--cm-bg-elevated)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cm-text-secondary)', fontSize: '0.9rem' }}>
                            Recording processing or unavailable.
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--cm-text-secondary)' }}>
                        <span>Candidate: <strong>{interview.candidate_name}</strong></span>
                        {videoUrl && (
                            <a
                                href={videoUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            >
                                <Download size={14} /> Download Recording
                            </a>
                        )}
                    </div>
                </div>

                {/* Right Side: Evaluation & Transcript Tabs */}
                <div className="card" style={{ padding: '1.25rem' }}>
                    {/* Tab Switcher */}
                    <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--cm-border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                        <button
                            onClick={() => setActiveTab('evaluation')}
                            className={`btn ${activeTab === 'evaluation' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }}
                        >
                            AI Evaluation
                        </button>
                        <button
                            onClick={() => setActiveTab('transcript')}
                            className={`btn ${activeTab === 'transcript' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }}
                        >
                            Transcript
                        </button>
                    </div>

                    {activeTab === 'evaluation' ? (
                        isHR ? (
                            /* ==================== GENERAL HR SCREENING EVALUATION ==================== */
                            <div>
                                {/* HR Review Status & Score Overview Banner */}
                                <div style={{
                                    background: 'var(--cm-bg-elevated)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '1.2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '1.25rem',
                                    border: '1px solid var(--cm-border-subtle)'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--cm-text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                                            HR Review Status
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: 'var(--radius-full)',
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                background: (evalData.review_status?.toLowerCase().includes('ready') || !evalData.review_status)
                                                    ? 'rgba(16, 185, 129, 0.15)'
                                                    : 'rgba(245, 158, 11, 0.15)',
                                                color: (evalData.review_status?.toLowerCase().includes('ready') || !evalData.review_status)
                                                    ? '#10B981'
                                                    : '#F59E0B',
                                                border: `1px solid ${(evalData.review_status?.toLowerCase().includes('ready') || !evalData.review_status)
                                                    ? 'rgba(16, 185, 129, 0.3)'
                                                    : 'rgba(245, 158, 11, 0.3)'}`
                                            }}>
                                                <ShieldCheck size={16} />
                                                {evalData.review_status || 'Ready for Human Review'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--cm-text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.2rem' }}>
                                            Avg Competency Score
                                        </div>
                                        {hrAverageScore ? (
                                            <div style={{
                                                fontSize: '1.6rem',
                                                fontWeight: 900,
                                                color: '#60A5FA',
                                                background: 'rgba(59, 130, 246, 0.15)',
                                                padding: '0.25rem 0.85rem',
                                                borderRadius: 'var(--radius-md)',
                                                display: 'inline-block'
                                            }}>
                                                {hrAverageScore} <span style={{ fontSize: '0.85rem', color: 'var(--cm-text-secondary)' }}>/ 10</span>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.85rem', color: 'var(--cm-text-tertiary)', fontStyle: 'italic' }}>
                                                Not Assessed
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 1. Interview Summary */}
                                {(evalData.interview_summary || result.summary) && (
                                    <div style={{ marginBottom: '1.25rem', background: 'var(--cm-bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--cm-border-subtle)' }}>
                                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cm-text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <FileText size={15} color="#3B82F6" />
                                            Interview Summary
                                        </h4>
                                        <p style={{ fontSize: '0.88rem', color: 'var(--cm-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                            {evalData.interview_summary || result.summary}
                                        </p>
                                    </div>
                                )}

                                {/* 2. Seven HR Competency Scores */}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cm-text-primary)', margin: 0 }}>
                                            HR Competencies (7 Dimensions)
                                        </h4>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--cm-text-tertiary)' }}>
                                            Scale 1–10 • Unassessed areas marked
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {hrCompetencies.map(({ key, label, desc }) => {
                                            const rawVal = evalData[key];
                                            const hasScore = typeof rawVal === 'number' && !isNaN(rawVal);

                                            return (
                                                <div
                                                    key={key}
                                                    style={{
                                                        background: 'var(--cm-bg-elevated)',
                                                        border: '1px solid var(--cm-border-subtle)',
                                                        borderRadius: 'var(--radius-md)',
                                                        padding: '0.7rem 0.95rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '1rem'
                                                    }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--cm-text-primary)', marginBottom: '0.1rem' }}>
                                                            {label}
                                                        </div>
                                                        <div style={{ fontSize: '0.74rem', color: 'var(--cm-text-secondary)' }}>
                                                            {desc}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', minWidth: '95px' }}>
                                                        {hasScore ? (
                                                            <div>
                                                                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: rawVal >= 7 ? '#10B981' : rawVal >= 5 ? '#60A5FA' : '#F59E0B' }}>
                                                                    {rawVal}
                                                                </span>
                                                                <span style={{ fontSize: '0.72rem', color: 'var(--cm-text-secondary)', marginLeft: '0.2rem' }}>/ 10</span>
                                                                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '0.25rem', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        width: `${Math.min(100, Math.max(0, rawVal * 10))}%`,
                                                                        height: '100%',
                                                                        background: rawVal >= 7 ? '#10B981' : rawVal >= 5 ? '#3B82F6' : '#F59E0B'
                                                                    }} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                fontWeight: 600,
                                                                color: 'var(--cm-text-tertiary)',
                                                                background: 'rgba(255, 255, 255, 0.05)',
                                                                padding: '0.2rem 0.55rem',
                                                                borderRadius: 'var(--radius-sm)',
                                                                border: '1px solid rgba(255, 255, 255, 0.08)'
                                                            }}>
                                                                Not Assessed
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 3. Key Strengths & Areas for Improvement */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
                                    <div style={{
                                        background: 'rgba(16, 185, 129, 0.06)',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '0.95rem'
                                    }}>
                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#34D399', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <CheckCircle2 size={16} color="#10B981" />
                                            Key Strengths
                                        </h4>
                                        <p style={{ fontSize: '0.84rem', color: 'var(--cm-text-primary)', lineHeight: 1.6, margin: 0 }}>
                                            {evalData.key_strengths || 'Candidate strengths demonstrated through conversational examples.'}
                                        </p>
                                    </div>

                                    <div style={{
                                        background: 'rgba(245, 158, 11, 0.06)',
                                        border: '1px solid rgba(245, 158, 11, 0.25)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '0.95rem'
                                    }}>
                                        <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#FBBF24', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <AlertCircle size={16} color="#F59E0B" />
                                            Areas for Improvement
                                        </h4>
                                        <p style={{ fontSize: '0.84rem', color: 'var(--cm-text-primary)', lineHeight: 1.6, margin: 0 }}>
                                            {evalData.areas_for_improvement || 'No significant development gaps highlighted in transcript.'}
                                        </p>
                                    </div>
                                </div>

                                {/* 4. Evaluation Reasoning */}
                                {evalData.evaluation_reasoning && (
                                    <div style={{ background: 'var(--cm-bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--cm-border-subtle)' }}>
                                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cm-text-primary)', marginBottom: '0.35rem' }}>
                                            Evaluation Reasoning & Evidence
                                        </h4>
                                        <p style={{ fontSize: '0.84rem', color: 'var(--cm-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                            {evalData.evaluation_reasoning}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ==================== SCHOLARSHIP EVALUATION ==================== */
                            <div>
                                {/* Overall Score Banner */}
                                <div style={{
                                    background: 'var(--cm-bg-elevated)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '1.25rem',
                                    border: '1px solid var(--cm-border-subtle)'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--cm-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                                            Overall Assessment
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cm-status-success)' }}>
                                            {evalData.recommendation || evalData.overall_recommendation || 'Recommended'}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: '1.75rem',
                                        fontWeight: 900,
                                        color: 'var(--cm-status-success)',
                                        background: 'var(--cm-status-success-bg)',
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: 'var(--radius-md)'
                                    }}>
                                        {scholarshipOverallScore} <span style={{ fontSize: '0.9rem', color: 'var(--cm-text-secondary)' }}>/ 10</span>
                                    </div>
                                </div>

                                {/* Summary */}
                                {result.summary && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--cm-text-primary)' }}>
                                            Executive Summary
                                        </h4>
                                        <p style={{ fontSize: '0.88rem', color: 'var(--cm-text-secondary)', lineHeight: 1.6 }}>
                                            {result.summary}
                                        </p>
                                    </div>
                                )}

                                {/* Criteria Breakdown Grid */}
                                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.6rem' }}>
                                    Assessment Dimensions
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                    {Object.entries(evalData).filter(([k]) => !['summary', 'recommendation', 'overall_recommendation', 'overall_score', 'interview_summary', 'key_strengths', 'areas_for_improvement', 'evaluation_reasoning', 'review_status'].includes(k)).map(([key, val]) => (
                                        <div key={key} style={{ background: 'var(--cm-bg-elevated)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--cm-text-secondary)', textTransform: 'capitalize' }}>
                                                {key.replace(/_/g, ' ')}
                                            </span>
                                            <strong style={{ fontSize: '0.88rem', color: '#60A5FA' }}>
                                                {typeof val === 'number' ? `${val}/10` : String(val)}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    ) : (
                        <div style={{
                            background: 'var(--cm-bg-elevated)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '1.25rem',
                            maxHeight: '480px',
                            overflowY: 'auto'
                        }}>
                            {(() => {
                                const raw = result.transcript || '';
                                if (!raw) return <div style={{ color: 'var(--cm-text-secondary)', padding: '1rem', textAlign: 'center' }}>No transcript recorded for this session.</div>;

                                // Strip any leading system prompt or metadata: locate first dialogue turn
                                let cleaned = raw.trim();
                                const dialogueIdx = cleaned.search(/(?:^|\n)(?:BOT|AI|ASSISTANT|INTERVIEWER|USER|CANDIDATE):/i);
                                if (dialogueIdx !== -1) {
                                    cleaned = cleaned.substring(dialogueIdx).trim();
                                } else {
                                    cleaned = cleaned.replace(/^SYSTEM:[\s\S]*?(?=(?:BOT|ASSISTANT|AI|INTERVIEWER|USER|CANDIDATE):)/i, '').trim();
                                }
                                if (!cleaned) return <div style={{ color: 'var(--cm-text-secondary)', padding: '1rem', textAlign: 'center' }}>No dialogue recorded for this session.</div>;

                                // Parse dialogue segments
                                const pattern = /(?:^|\n\n?)(BOT|ASSISTANT|AI|INTERVIEWER|USER|CANDIDATE|HUMAN):\s*/gi;
                                const matches = Array.from(cleaned.matchAll(pattern));

                                if (matches.length === 0) {
                                    return (
                                        <div style={{ fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#F1F5F9' }}>
                                            {cleaned}
                                        </div>
                                    );
                                }

                                const segments = [];
                                for (let i = 0; i < matches.length; i++) {
                                    const current = matches[i];
                                    const speakerTag = current[1].toUpperCase();
                                    const contentStart = current.index + current[0].length;
                                    const contentEnd = (i + 1 < matches.length) ? matches[i + 1].index : cleaned.length;
                                    const messageText = cleaned.substring(contentStart, contentEnd).trim();

                                    if (messageText) {
                                        const isAI = ['BOT', 'ASSISTANT', 'AI', 'INTERVIEWER'].includes(speakerTag);
                                        segments.push({
                                            speaker: isAI ? 'AI Interviewer' : (interview?.candidate_name || 'Candidate'),
                                            isAI,
                                            text: messageText
                                        });
                                    }
                                }

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                        {segments.map((seg, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '0.8rem 1rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: seg.isAI ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                                    borderLeft: seg.isAI ? '3px solid #3B82F6' : '3px solid #10B981',
                                                    fontSize: '0.88rem',
                                                    lineHeight: 1.6
                                                }}
                                            >
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.45rem',
                                                    marginBottom: '0.35rem',
                                                    fontWeight: 700,
                                                    fontSize: '0.78rem',
                                                    color: seg.isAI ? '#60A5FA' : '#34D399',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.04em'
                                                }}>
                                                    <span>{seg.isAI ? '🤖 ' : '👤 '}{seg.speaker}</span>
                                                </div>
                                                <div style={{ color: '#F1F5F9', whiteSpace: 'pre-wrap' }}>
                                                    {seg.text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
