# Explainable Machine Learning Laboratory

A deeply interactive, pedagogical machine learning platform designed to visualize how fundamental AI algorithms structure geometric decisions. Move beyond basic black-box validation scores and physically probe the decision-making strategies of various algorithms in real-time.

## 🚀 Interactive Visual Inference
Rather than returning passive text explanations, this platform dynamically renders algorithm behavior onto a responsive React canvas.
- **Support Vector Machines**: Physically traces the tension between the boundary and exact Support Vectors.
- **K-Nearest Neighbors**: Visualizes local clusters by connecting your cursor to defining voter points.
- **Neural Networks (MLP)**: Spotlights structural "bending" via glowing curvature lenses to map non-linear geometry.

## 🌐 Features
1. **Topographic Uncertainty Engine**: Explores probabilistic confusion boundaries by explicitly tracking contour slices exactly where the math breaks down ($P = 0.5$).
2. **Pulsating Failure Flags**: Decouples heavy data-processing onto off-screen canvases to reserve 60fps animations for real-time misclassification tracking.
3. **Dual Model Evaluation**: Allows side-by-side behavioral tracking (Evaluating why an algorithm succeeds architecturally, vs arbitrary validation percentages).

## 🛠 Tech Stack
* **Frontend**: React, Vite, HTML5 Canvas 2D (Pixel manipulation / Interpolation)
* **Backend**: Django Data Pipeline, Django REST Framework, SimpleJWT Auth
* **Machine Learning**: Scikit-learn, Pandas

## Run Globally
*Requires Python 3+ and Node JS (v18+).*

```bash
# 1. Spin up the Database and Data API
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# 2. Boot up the Visualization Application
cd frontend
npm install
npm run dev
```
