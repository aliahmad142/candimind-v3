import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HRDashboard from './pages/HRDashboard';
import CandidateInterview from './pages/CandidateInterview';
import './index.css';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HRDashboard />} />
                <Route path="/interview/:uniqueId" element={<CandidateInterview />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
