import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await axios.post("http://localhost:8000/api/register/", { username, password });
      }
      const res = await axios.post("http://localhost:8000/api/token/", { username, password });
      localStorage.setItem("access_token", res.data.access);
      localStorage.setItem("refresh_token", res.data.refresh);
      localStorage.setItem("username", username);
      navigate("/lab");
    } catch (err) {
      setError("Authentication failed. Please check your credentials.");
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div className="glass-panel training-panel" style={{ width: '400px' }}>
        <h2 className="panel-title" style={{ textAlign: 'center', marginBottom: '20px' }}>
          {isRegister ? "Create Lab Account" : "Access ML Lab"}
        </h2>
        {error && <div style={{ color: '#ff4757', marginBottom: '10px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            className="styled-select"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ backgroundImage: 'none' }}
          />
          <input
            className="styled-select"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ backgroundImage: 'none' }}
          />
          <button className="btn-train" type="submit" style={{ marginTop: '10px' }}>
            {isRegister ? "Register" : "Login"}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '15px', color: '#8b8b9e', fontSize: '13px', cursor: 'pointer' }} onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "Already have an account? Login" : "Need an account? Register"}
        </div>
      </div>
    </div>
  );
}
