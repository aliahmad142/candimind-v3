import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interview API calls
export const interviewAPI = {
    // Create a new interview link
    createInterview: async (candidateName, candidateEmail, role) => {
        const response = await api.post('/api/interviews/create', {
            candidate_name: candidateName,
            candidate_email: candidateEmail,
            role: role,
        });
        return response.data;
    },

    // Get all interviews
    listInterviews: async (filters = {}) => {
        const response = await api.get('/api/interviews', { params: filters });
        return response.data;
    },

    // Get specific interview
    getInterview: async (interviewId) => {
        const response = await api.get(`/api/interviews/${interviewId}`);
        return response.data;
    },

    // Get interview by unique ID (for candidate page)
    getInterviewByUID: async (uniqueId) => {
        const response = await api.get(`/api/interviews/by-uid/${uniqueId}`);
        return response.data;
    },

    // Manually complete interview with evaluation data (for local testing)
    completeInterview: async (interviewId, evaluationData) => {
        const response = await api.post(`/api/interviews/${interviewId}/complete`, evaluationData);
        return response.data;
    },

    // Delete interview
    deleteInterview: async (interviewId) => {
        const response = await api.delete(`/api/interviews/${interviewId}`);
        return response.data;
    },

    // Verify password for interview access
    verifyPassword: async (uniqueId, password) => {
        const response = await api.post(`/api/interviews/by-uid/${uniqueId}/verify-password`, {
            password: password
        });
        return response.data;
    },

    // Fetch results from VAPI (manual fallback)
    fetchResults: async (interviewId) => {
        const response = await api.post(`/api/interviews/${interviewId}/fetch-results`);
        return response.data;
    },
};

export default api;
