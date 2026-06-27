// src/App.jsx – Main application with routing
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ChatSimulator from './ui/simulator/ChatSimulator';
import MyProjects from './pages/MyProjects';
import GeneratedApps from './pages/GeneratedApps';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/simulator" replace />} />
        <Route path="/simulator" element={<ChatSimulator />} />
        <Route path="/my-projects" element={<MyProjects />} />
        <Route path="/generated-apps" element={<GeneratedApps />} />
      </Routes>
    </Router>
  );
}

export default App;
