import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function Dashboard() {
  const [experiments, setExperiments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/");
      return;
    }

    axios.get("http://localhost:8000/api/experiments/", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setExperiments(res.data))
    .catch(err => {
        if (err.response?.status === 401) {
            localStorage.clear();
            navigate("/");
        }
    });
  }, [navigate]);

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 className="app-title" style={{ margin: 0, textAlign: 'left', width: 'auto' }}>History Log</h1>
        <div>
           <Link to="/lab" style={{ color: '#6c63ff', textDecoration: 'none', marginRight: '20px', fontWeight: 'bold' }}>To Lab →</Link>
           <button className="btn-train" onClick={() => { localStorage.clear(); navigate("/"); }}>Logout</button>
        </div>
      </div>

      <div className="panels-grid">
        {experiments.length === 0 ? (
          <div style={{ color: '#8b8b9e' }}>No experiments found. Run some models in the lab!</div>
        ) : (
          experiments.map(exp => (
            <div key={exp.id} className="glass-panel training-panel">
              <div className="panel-header">
                <h3 className="panel-title">{exp.dataset_name}</h3>
                <span className="metric-value">{(exp.accuracy * 100).toFixed(1)}%</span>
              </div>
              <div style={{ color: '#8b8b9e', fontSize: '14px' }}>
                <div><strong>Model:</strong> {exp.model_type.toUpperCase()}</div>
                <div><strong>Date:</strong> {new Date(exp.run_date).toLocaleDateString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
