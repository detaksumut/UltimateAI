// src/App.jsx – Main application with routing
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ResearchBuilder from './pages/ResearchBuilder';
import MyProjects from './pages/MyProjects';
import GeneratedApps from './pages/GeneratedApps';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/research-builder" replace />} />
        <Route path="/research-builder" element={<ResearchBuilder />} />
        <Route path="/my-projects" element={<MyProjects />} />
        <Route path="/generated-apps" element={<GeneratedApps />} />
      </Routes>
    </Router>
  );
}

export default App;
