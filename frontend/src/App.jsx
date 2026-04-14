import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import TrainingPanel from "./TrainingPanel";
import Login from "./Login";
import Dashboard from "./Dashboard";
import "./App.css";
import axios from "axios";

// Intercept 401 responses to automatically clear expired tokens
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

function ComparisonEngine({ a, b }) {
    if (!a?.accuracy || !b?.accuracy) return null;

    const insights = [];

    // Compare accuracy
    if (a.dataset === b.dataset) {
       if (a.accuracy > b.accuracy) {
           insights.push(`🏆 Model A (${a.model.toUpperCase()}) outperforms Model B by ${((a.accuracy - b.accuracy)*100).toFixed(1)}% on the ${a.dataset} dataset.`);
       } else if (b.accuracy > a.accuracy) {
           insights.push(`🏆 Model B (${b.model.toUpperCase()}) outperforms Model A by ${((b.accuracy - a.accuracy)*100).toFixed(1)}% on the ${a.dataset} dataset.`);
       } else {
           insights.push(`🤝 Both models achieve identical final accuracy on ${a.dataset}.`);
       }
    } else {
       insights.push(`⚠️ Models are actively training on different datasets (${a.dataset} vs ${b.dataset}). Direct performance comparisons are moot.`);
    }

    // Compare logic
    const isLinear = (m) => m === 'logreg' || m === 'svm';
    const isCurved = (m) => m === 'mlp' || m === 'knn' || m === 'rf';
    // isOverfit check
    const isOverfit = (m, acc) => (m === 'mlp' || m === 'rf') && acc >= 0.99;

    if (a.accuracy > b.accuracy) {
        if (isCurved(a.model) && isLinear(b.model)) {
            insights.push(`Model A performs better because:
- it captures the curved structure of the data
- Model B uses simpler linear boundaries and misses this fundamental pattern`);
        } else if (isLinear(a.model) && isCurved(b.model)) {
            insights.push(`Model A performs better because:
- the dataset naturally clusters linearly
- Model B is overly complex and struggles to formalize a simple boundary`);
        }
    } else if (b.accuracy > a.accuracy) {
        if (isCurved(b.model) && isLinear(a.model)) {
            insights.push(`Model B performs better because:
- it captures the curved structure of the data
- Model A uses simpler linear boundaries and misses this fundamental pattern`);
        } else if (isLinear(b.model) && isCurved(a.model)) {
            insights.push(`Model B performs better because:
- the dataset naturally clusters linearly
- Model A is overly complex and struggles to formalize a simple boundary`);
        }
    }

    if (isOverfit(a.model, a.accuracy) && !isOverfit(b.model, b.accuracy)) {
        insights.push(`⚠️ Beware: Model A looks perfect, but it may be dangerously overfitting to noise. Model B is performing significantly safer and may generalize better.`);
    }

    return (
        <div className="glass-panel" style={{ marginTop: '30px', padding: '25px', borderLeft: '4px solid #ab47ff' }}>
            <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{color: '#ab47ff'}}>⚡</span> Model Comparison Engine
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {insights.map((ins, i) => (
                    <div key={i} style={{ color: '#f0f0f5', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {ins}
                    </div>
                ))}
            </div>
        </div>
    );
}

function LabPage() {
  const [stateA, setStateA] = useState(null);
  const [stateB, setStateB] = useState(null);

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 className="app-title" style={{ margin: 0, textAlign: 'left', width: 'auto' }}>Explainable ML Lab</h1>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{color: '#8b8b9e', fontSize: '14px'}}>User: {localStorage.getItem("username")}</span>
            <a href="/dashboard" style={{ color: '#6c63ff', textDecoration: 'none', fontWeight: 'bold' }}>Dashboard</a>
        </div>
      </div>

      <div className="panels-grid">
        <TrainingPanel title="A" onStateChange={setStateA} />
        <TrainingPanel title="B" onStateChange={setStateB} />
      </div>

      <ComparisonEngine a={stateA} b={stateB} />
    </div>
  );
}

// Simple Protected Route wrapper
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token");
  return token ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/lab" element={<ProtectedRoute><LabPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;