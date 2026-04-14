import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function TrainingPanel({ title, onStateChange }) {
  const [data, setData] = useState([]);
  const [boundary, setBoundary] = useState(null);
  const [dataset, setDataset] = useState("moons");
  const [model, setModel] = useState("mlp");
  const [accuracy, setAccuracy] = useState(null);
  const [points, setPoints] = useState([]);
  const [labels, setLabels] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [range, setRange] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [status, setStatus] = useState("Idle");
  
  const [customDatasets, setCustomDatasets] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const canvasRef = useRef(null);
  const accuracyHistory = useRef([]);

  useEffect(() => {
    // Fetch custom datasets on mount
    const token = localStorage.getItem("access_token");
    if (token) {
        axios.get("http://localhost:8000/api/datasets/", {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => setCustomDatasets(res.data)).catch(err => console.log(err));
    }
  }, []);

  useEffect(() => {
      if (onStateChange) {
          onStateChange({ model, dataset, accuracy, status });
      }
  }, [model, dataset, accuracy, status, onStateChange]);

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("csv_file", file);
      const name = file.name.split(".")[0];
      formData.append("name", name);

      const token = localStorage.getItem("access_token");
      try {
          setUploadStatus("Uploading...");
          const res = await axios.post("http://localhost:8000/api/datasets/", formData, {
              headers: { 
                  "Content-Type": "multipart/form-data",
                  Authorization: `Bearer ${token}`
              }
          });
          setCustomDatasets([res.data, ...customDatasets]);
          setDataset(res.data.name);
          setUploadStatus("Uploaded!");
          setTimeout(() => setUploadStatus(""), 2000);
      } catch (err) {
          setUploadStatus("Upload failed.");
          setTimeout(() => setUploadStatus(""), 2000);
      }
  };

  const saveExperiment = async () => {
    if (!accuracy || !model) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
        setSaveStatus("Saving...");
        await axios.post("http://localhost:8000/api/experiments/", {
             dataset_name: dataset,
             model_type: model,
             accuracy: accuracy
        }, {
             headers: { Authorization: `Bearer ${token}` }
        });
        setSaveStatus("Saved to Dashboard!");
        setTimeout(() => setSaveStatus(""), 2500);
    } catch (err) {
        setSaveStatus("Error saving.");
        setTimeout(() => setSaveStatus(""), 2000);
    }
  };

  const startTraining = () => {
    setData([]); // reset chart
    setBoundary(null); // reset boundary
    setStatus("Initializing...");
    accuracyHistory.current = [];

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/train/${title}/`);

    ws.onmessage = (e) => {
        const newData = JSON.parse(e.data);

        setData((prev) => [
            ...prev,
            {
            epoch: newData.epoch,
            loss: newData.loss
            }
        ]);

        if (newData.boundary) {
            setBoundary(newData.boundary);
        }

        if (newData.accuracy !== null) {
            setAccuracy(newData.accuracy);
            
            accuracyHistory.current.push(newData.accuracy);
            if (accuracyHistory.current.length > 5) accuracyHistory.current.shift();
            
            if (model === "mlp" || model === "rf") {
                if (accuracyHistory.current.length === 5 && new Set(accuracyHistory.current).size === 1) {
                    setStatus("Stable");
                } else {
                    setStatus("Learning...");
                }
            } else {
                setStatus("Converged Immediately");
            }
        }

        if (newData.points) {
            setPoints(newData.points);
            setLabels(newData.labels);
        }
        if (newData.predictions) {
            setPredictions(newData.predictions);
        }
        if (newData.range) {
            setRange(newData.range);
        }
        if (newData.metadata) {
            setMetadata(newData.metadata);
        }
        };

    ws.onopen = () => {
      ws.send(JSON.stringify({
        epochs: 50,
        dataset: dataset,
        model: model
        }));

    };
  };

  // Draw decision boundary with probabilities
  const offscreenCanvasRef = useRef(null);

  useEffect(() => {
    if (!boundary || boundary.length === 0) return;

    const rows = boundary.length;
    const cols = boundary[0].length;

    const offscreen = document.createElement("canvas");
    offscreen.width = cols;
    offscreen.height = rows;
    const offCtx = offscreen.getContext("2d");
    const imgData = offCtx.createImageData(cols, rows);

    // Yellow (#FFB703) to Purple (#6C63FF)
    // RGB Yellow: 255, 183, 3. RGB Purple: 108, 99, 255.
    for (let i = 0; i < rows; i++) {
      // Meshgrid starts y_min at i=0. Canvas y=0 is top. We flip Y axis:
      const drawY = rows - 1 - i;

      for (let j = 0; j < cols; j++) {
        const prob = boundary[i][j];
        const p = Math.max(0, Math.min(1, prob)); // Clamp to [0, 1]

        const idx = (drawY * cols + j) * 4;

        let r, g, b;
        if (p > 0.48 && p < 0.52) {
           // topographical contour boundary layer
           r = 255; g = 255; b = 255;
        } else {
           r = Math.round(255 + p * (108 - 255));
           g = Math.round(183 + p * (99 - 183));
           b = Math.round(3 + p * (255 - 3));
        }

        imgData.data[idx] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 255;
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    offscreenCanvasRef.current = offscreen;
  }, [boundary]);

  // Main Render Loop
  const visualState = useRef({ points, labels, predictions, range, metadata, hoverPos, model });
  useEffect(() => {
     visualState.current = { points, labels, predictions, range, metadata, hoverPos, model };
  }, [points, labels, predictions, range, metadata, hoverPos, model]);

  useEffect(() => {
    let animationFrameId;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      
      const { points: pts, labels: lbls, predictions: preds, range: rr, metadata: md, hoverPos: hp, model: m } = visualState.current;

      // Draw Offscreen Boundary
      if (offscreenCanvasRef.current) {
         ctx.imageSmoothingEnabled = true;
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.drawImage(offscreenCanvasRef.current, 0, 0, canvas.width, canvas.height);
      }

      // Draw Points & Halos
      if (rr && pts) {
          const { xMin, xMax, yMin, yMax } = rr;
          
          pts.forEach((p, i) => {
             const x = ((p[0] - xMin) / (xMax - xMin)) * canvas.width;
             const y = canvas.height - ((p[1] - yMin) / (yMax - yMin)) * canvas.height;

             ctx.beginPath();
             ctx.arc(x, y, 4, 0, 2 * Math.PI);
             ctx.fillStyle = lbls[i] === 0 ? "#FFB703" : "#6C63FF";
             ctx.fill();

             if (preds.length > 0 && preds[i] !== lbls[i]) {
                 const pulse = (Math.sin(Date.now() / 150) + 1) / 2; 
                 ctx.strokeStyle = `rgba(255, 71, 87, ${0.4 + pulse * 0.6})`;
                 ctx.lineWidth = 2.5; 
                 ctx.shadowColor = "#ff4757"; 
                 ctx.shadowBlur = 5 + pulse * 5;
             } else {
                 ctx.strokeStyle = "#fff";
                 ctx.lineWidth = 1.5;
                 ctx.shadowBlur = 0;
             }
             ctx.stroke();
             ctx.shadowBlur = 0; 
          });

          // Draw Explanability Dynamic Traces
          if (m === "svm" && hp && md?.support_vectors) {
              const svs = md.support_vectors.map(sv => {
                  const sx = ((sv[0] - xMin) / (xMax - xMin)) * canvas.width;
                  const sy = canvas.height - ((sv[1] - yMin) / (yMax - yMin)) * canvas.height;
                  return { sx, sy, d: Math.hypot(sx - hp.cx, sy - hp.cy) };
              }).sort((a,b) => a.d - b.d).slice(0, 3);
              
              svs.forEach(sv => {
                  ctx.beginPath();
                  ctx.moveTo(hp.cx, hp.cy);
                  ctx.lineTo(sv.sx, sv.sy);
                  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
                  ctx.lineWidth = 1.5;
                  ctx.setLineDash([4, 4]);
                  ctx.stroke();
                  ctx.setLineDash([]);
                  
                  ctx.beginPath();
                  ctx.arc(sv.sx, sv.sy, 6, 0, 2*Math.PI);
                  ctx.strokeStyle = "#fff";
                  ctx.shadowColor = "#fff";
                  ctx.shadowBlur = 8;
                  ctx.stroke();
                  ctx.shadowBlur = 0;
              });
          }

          if (m === "knn" && hp && pts) {
              const distances = pts.map((p, idx) => ({
                 idx,
                 d: Math.pow(p[0] - hp.realX, 2) + Math.pow(p[1] - hp.realY, 2)
              })).sort((a, b) => a.d - b.d).slice(0, 3); // Reduced to top 3 for cleaner visual
              
              const maxD = distances[distances.length - 1].d || 1;
              
              distances.forEach((neighbor) => {
                 const p = pts[neighbor.idx];
                 const nx = ((p[0] - xMin) / (xMax - xMin)) * canvas.width;
                 const ny = canvas.height - ((p[1] - yMin) / (yMax - yMin)) * canvas.height;
                 
                 const opacity = Math.max(0.2, 1 - (neighbor.d / (maxD * 1.5)));
                 
                 ctx.beginPath();
                 ctx.moveTo(hp.cx, hp.cy);
                 ctx.lineTo(nx, ny);
                 ctx.strokeStyle = lbls[neighbor.idx] === 0 ? `rgba(255, 183, 3, ${opacity})` : `rgba(108, 99, 255, ${opacity})`;
                 ctx.lineWidth = 1.5;
                 ctx.setLineDash([2, 4]);
                 ctx.stroke();
                 ctx.setLineDash([]);
              });
          }

          if (m === "rf" && hp) {
             ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
             ctx.fillRect(hp.cx - 25, hp.cy - 25, 50, 50);
             ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
             ctx.lineWidth = 2.5;
             ctx.strokeRect(hp.cx - 25, hp.cy - 25, 50, 50);
          }

          if (m === "logreg" && hp && md?.weights) {
              const w0 = md.weights[0];
              const w1 = md.weights[1];
              const b = md.bias;
              const getPy = (px) => (-w0 * px - b) / w1;
              const x1 = xMin;
              const y1 = getPy(x1);
              const x2 = xMax;
              const y2 = getPy(x2);
              const cx1 = ((x1 - xMin) / (xMax - xMin)) * canvas.width;
              const cy1 = canvas.height - ((y1 - yMin) / (yMax - yMin)) * canvas.height;
              const cx2 = ((x2 - xMin) / (xMax - xMin)) * canvas.width;
              const cy2 = canvas.height - ((y2 - yMin) / (yMax - yMin)) * canvas.height;

              ctx.beginPath();
              ctx.moveTo(cx1, cy1);
              ctx.lineTo(cx2, cy2);
              ctx.strokeStyle = "rgba(255, 255, 255, 1)";
              ctx.lineWidth = 3;
              ctx.shadowColor = "#fff";
              ctx.shadowBlur = 10;
              ctx.stroke();
              ctx.shadowBlur = 0;
          }

          if (m === "mlp" && hp) {
             ctx.beginPath();
             ctx.arc(hp.cx, hp.cy, 30, 0, 2*Math.PI);
             ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
             ctx.fill();
             ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
             ctx.lineWidth = 4;
             ctx.stroke();
          }
      }
      
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !range || !boundary) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Map to scale
    const realX = range.xMin + (x / rect.width) * (range.xMax - range.xMin);
    const realY = range.yMin + ((rect.height - y) / rect.height) * (range.yMax - range.yMin);
    
    // Map x,y to the 100x100 boundary matrix
    const cols = boundary[0].length;
    const rows = boundary.length;
    const gridX = Math.min(cols - 1, Math.max(0, Math.floor((x / rect.width) * cols)));
    const gridY = Math.min(rows - 1, Math.max(0, rows - 1 - Math.floor((y / rect.height) * rows)));

    const p = boundary[gridY][gridX]; 
    const prediction = p >= 0.5 ? 1 : 0;
    const confidence = Math.round(Math.abs(p - 0.5) * 200);

    let modelInsights = "";
    if (model === "svm") {
       modelInsights = `These nearby support vectors define the margin separating the classes.`;
    } else if (model === "knn") {
       modelInsights = `These nearby points determine the classification at this location.`;
    } else if (model === "logreg") {
       modelInsights = `This model uses a single straight boundary to separate the two classes.`;
    } else if (model === "mlp") {
       modelInsights = `Boundary bends here due to complex non-linear combinations of distant points.`;
    } else if (model === "rf") {
       modelInsights = `This region is created by multiple decision splits, and all points inside are classified the same way.`;
    }

    let uncertaintyInsight = "";
    if (confidence < 30) {
        uncertaintyInsight = "This point lies near the boundary, so the model is uncertain.";
    } else if (confidence > 70) {
        uncertaintyInsight = "This point lies deep inside a region, so the model is confident.";
    } else {
        uncertaintyInsight = "This point is in a transitional zone where confidence is moderate.";
    }

    setHoverPos({ cx: x, cy: y, cWidth: rect.width, cHeight: rect.height, realX, realY, prediction, confidence, modelInsights, uncertaintyInsight });
  };

  const generateInsights = () => {
    const insights = [];
    if (!accuracy || !model) return insights;

    if (accuracy === 1.0) {
        insights.push("🟢 Model captured all points perfectly.");
        if (model === "mlp" || model === "rf") {
            insights.push("⚠️ Look at the boundary wrapping points tightly. It is dangerously overfitting.");
        }
    } else if (accuracy < 0.6) {
        insights.push("🔴 Model is effectively guessing blindly.");
        if (model === "logreg" && (dataset === "circles" || dataset === "moons")) {
            insights.push("💡 A straight line cannot cut a circle. This linear model is structurally incompatible.");
        }
    }

    // Add Misclassification count insight dynamically
    if (predictions && labels && predictions.length > 0) {
        let errs = 0;
        for (let i = 0; i < predictions.length; i++) {
           if (predictions[i] !== labels[i]) errs++;
        }
        if (errs > 0) insights.push(`🔴 ${errs} points are glowing red because they are misclassified.`);
    }

    if (model === "svm" && metadata?.support_vectors) {
        insights.push(`📐 Exactly ${metadata.support_vectors.length} Support Vectors are physically outlining the visible margin.`);
    }

    if (model === "knn") {
        insights.push(`🔍 Hover anywhere to see the 5 specific voters controlling that local zone.`);
    }
    
    if (model === "logreg" && metadata?.weights) {
        insights.push(`⚖️ LogReg is projecting rigid confidence purely based on distance from the line.`);
    }

    return insights;
  };

  const insights = generateInsights();

  return (
  <div className="glass-panel training-panel">
    <div className="panel-header">
      <h2 className="panel-title">Model {title}</h2>

      <div style={{ display: 'flex', gap: '10px' }}>
         <button className="btn-train" onClick={startTraining}>
           Start Run
         </button>
         <button 
           className="btn-train" 
           style={{ background: 'rgba(255,255,255,0.1)', boxShadow: 'none' }} 
           onClick={saveExperiment}
           disabled={!accuracy}
         >
           {saveStatus || "Save Run"}
         </button>
      </div>
    </div>

    {/* Controls */}
    <div className="controls-row">
      <select className="styled-select" value={dataset} onChange={(e) => setDataset(e.target.value)}>
        <optgroup label="Default Datasets">
            <option value="moons">Moons Dataset</option>
            <option value="circles">Circles Dataset</option>
            <option value="blobs">Blobs Dataset</option>
        </optgroup>
        {customDatasets.length > 0 && (
            <optgroup label="Your Datasets">
                {customDatasets.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                ))}
            </optgroup>
        )}
      </select>

      <label className="btn-train" style={{ background: 'rgba(255,255,255,0.1)', cursor: 'pointer', textAlign: 'center', boxShadow: 'none' }}>
         {uploadStatus || "Upload CSV"}
         <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
      </label>

      <select className="styled-select" value={model} onChange={(e) => setModel(e.target.value)}>
        <option value="mlp">Neural Net (MLP)</option>
        <option value="svm">Support Vector Machine</option>
        <option value="rf">Random Forest</option>
        <option value="logreg">Logistic Regression</option>
        <option value="knn">K-Nearest Neighbors</option>
      </select>
    </div>

    {/* Accuracy & Status */}
    <div style={{ display: 'flex', gap: '10px' }}>
        <div className="metric-bar" style={{ flex: 1 }}>
          <span style={{ fontSize: '12px' }}>STATUS</span>
          <span className="metric-value">{accuracy ? status : "Idle"}</span>
        </div>
        <div className="metric-bar" style={{ flex: 1 }}>
          <span style={{ fontSize: '12px' }}>VALIDATION ACCURACY</span>
          <span className="metric-value">{accuracy ? (accuracy * 100).toFixed(1) + "%" : "--"}</span>
        </div>
    </div>

    <div className="viz-container">
      {/* Boundary */}
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="ml-canvas"
          onMouseMove={handleMouseMove}
          onMouseOut={() => setHoverPos(null)}
        />
        
        {hoverPos && (
            <div className="probe-tooltip" style={{ 
                left: hoverPos.cx > hoverPos.cWidth / 2 ? hoverPos.cx - 240 : hoverPos.cx + 25,
                top: hoverPos.cy > hoverPos.cHeight / 2 ? hoverPos.cy - 140 : hoverPos.cy + 25,
                maxWidth: '220px', 
                background: 'rgba(20, 20, 30, 0.75)', 
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                pointerEvents: 'none',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)', 
                zIndex: 10 
            }}>
                <div style={{ fontWeight: '600', color: '#fff', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                    Probe Region Math
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                   <span style={{ color: '#8b8b9e' }}>X, Y:</span>
                   <span>({hoverPos.realX.toFixed(2)}, {hoverPos.realY.toFixed(2)})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                   <span style={{ color: '#8b8b9e' }}>Confidence:</span>
                   <span style={{ color: hoverPos.confidence < 30 ? '#FFB703' : '#6c63ff'}}>{hoverPos.confidence}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span style={{ color: '#8b8b9e' }}>Prediction:</span>
                   <span style={{ color: hoverPos.prediction === 0 ? '#FFB703' : '#6c63ff', fontWeight: 'bold' }}>
                      {hoverPos.prediction === 0 ? 'Yellow' : 'Purple'}
                   </span>
                </div>
                <div style={{ color: '#c5c9ff', paddingBottom: '4px', fontSize: '11px', lineHeight: '1.4' }}>
                   {hoverPos.uncertaintyInsight}
                </div>
                <div style={{ color: '#aab2ff', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', fontSize: '11px', lineHeight: '1.4' }}>
                   {hoverPos.modelInsights}
                </div>
            </div>
        )}
      </div>

      <div style={{ width: '100%', height: '8px', background: 'linear-gradient(to right, #FFB703, #8a88a0, #6C63FF)', borderRadius: '4px', marginTop: '10px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8b8b9e', marginTop: '4px' }}>
         <span>100% Yellow</span>
         <span>High Uncertainty Zone</span>
         <span>100% Purple</span>
      </div>

      {/* Insights Panel */}
      <div className="insights-engine" style={{ marginTop: '15px' }}>
        <div className="insights-header">Live Analytics</div>
        {insights.map((msg, i) => {
           let type = "";
           if (msg.includes("⚠️") || msg.includes("🔴")) type = "danger";
           if (msg.includes("💡") || msg.includes("📐")) type = "warning";
           return (
              <div key={i} className={`insight-card ${type}`}>
                 {msg}
              </div>
           );
        })}

        {/* Loss Curve via Recharts */}
        {(model === "mlp" || model === "rf") && data.length > 0 && (
          <div style={{ marginTop: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "10px", border: "1px solid rgba(255,255,255,0.05)", width: '100%', height: '140px' }}>
            <div className="insights-header" style={{ marginBottom: "5px" }}>Loss Progression</div>
            <ResponsiveContainer width="100%" height="80%">
                <LineChart data={data}>
                  <XAxis dataKey="epoch" tick={{ fill: '#8b8b9e', fontSize: 10 }} stroke="none" />
                  <YAxis tick={{ fill: '#8b8b9e', fontSize: 10 }} stroke="none" width={30} />
                  <Tooltip contentStyle={{ background: '#1c1c24', border: '1px solid #6c63ff', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
                  <Line type="monotone" dataKey="loss" stroke="#6C63FF" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
