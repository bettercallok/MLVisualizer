import json
import asyncio
import numpy as np

from channels.generic.websocket import AsyncWebsocketConsumer

from sklearn.datasets import make_moons, make_circles, make_blobs
from sklearn.neural_network import MLPClassifier
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from channels.db import database_sync_to_async
from .models import CustomDataset
import pandas as pd


# 📊 Dataset factory
def get_dataset(name):
    if name == "moons":
        return make_moons(n_samples=200, noise=0.2)
    elif name == "circles":
        return make_circles(n_samples=200, noise=0.1)
    elif name == "blobs":
        return make_blobs(n_samples=200, centers=2)
    else:
        return make_moons(n_samples=200, noise=0.2)

@database_sync_to_async
def get_custom_dataset(name):
    try:
        ds = CustomDataset.objects.filter(name=name).first()
        if not ds: return None, None
        df = pd.read_csv(ds.csv_file.path)

        target_col = None
        for col in ['target', 'label', 'y']:
            if col in [c.lower() for c in df.columns]:
                target_col = df.columns[[c.lower() for c in df.columns].index(col)]
                break
        if not target_col:
            target_col = df.columns[-1]
        
        X = df.drop(columns=[target_col]).values
        y = df[target_col].values
        
        # Normalize Data to prevent visual scaling destruction
        import numpy as np
        if X.std(axis=0).all() != 0:
            X = (X - X.mean(axis=0)) / X.std(axis=0)
        
        return X, y
    except Exception as e:
        return None, None

# 🤖 Model factory
def get_model(name):
    if name == "mlp":
        return MLPClassifier(hidden_layer_sizes=(10,), warm_start=True, max_iter=1)

    elif name == "svm":
        return SVC(probability=True)

    elif name == "rf":
        return RandomForestClassifier(n_estimators=1, warm_start=True)

    elif name == "logreg":
        return LogisticRegression()

    elif name == "knn":
        return KNeighborsClassifier(n_neighbors=5)

    else:
        return MLPClassifier(hidden_layer_sizes=(10,), warm_start=True, max_iter=1)


# 🧠 Decision boundary
def compute_boundary(model, X):
    x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
    y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5

    xx, yy = np.meshgrid(
        np.linspace(x_min, x_max, 100),
        np.linspace(y_min, y_max, 100)
    )

    grid = np.c_[xx.ravel(), yy.ravel()]
    if hasattr(model, "predict_proba"):
        preds = model.predict_proba(grid)[:, 1] # Probability of Class 1
    else:
        preds = model.predict(grid)

    return preds.reshape(xx.shape).tolist()


class TrainConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.model_id = self.scope["url_route"]["kwargs"]["model_id"]
        print(f"Connected: Model {self.model_id}")
        await self.accept()

    async def disconnect(self, close_code):
        print(f"Disconnected: Model {self.model_id}")

    async def receive(self, text_data):
        data = json.loads(text_data)

        # 🔥 default epochs = 100
        epochs = data.get("epochs", 100)
        dataset_name = data.get("dataset", "moons")
        model_name = data.get("model", "mlp")

        # 📊 Dataset
        if dataset_name in ["moons", "circles", "blobs"]:
            X, y = get_dataset(dataset_name)
        else:
            X, y = await get_custom_dataset(dataset_name)
            if X is None:
                X, y = get_dataset("moons")

        # 🤖 Model
        model = get_model(model_name)

        for epoch in range(epochs):

            # 🔁 TRAINING LOGIC
            if model_name == "mlp":
                model.fit(X, y)  # 1 step per loop (because max_iter=1)
                loss = model.loss_

            elif model_name == "rf":
                model.n_estimators = epoch + 1
                model.fit(X, y)
                loss = model.score(X, y)

            else:
                # Train only once for non-iterative models
                if epoch == 0:
                    model.fit(X, y)
                else:
                    # Do not loop and re-calculate boundary 100 times for SVM/KNN/LogReg
                    break
                loss = model.score(X, y)  # use accuracy as proxy

            boundary = None
            accuracy = None

            # 🔥 update EVERY epoch for smooth animation
            boundary = compute_boundary(model, X)
            accuracy = model.score(X, y)

            # 🧠 Mathemtical Explainability Extractions
            metadata = {}
            if model_name == "svm":
                # SVM: expose support vectors to highlight them
                if hasattr(model, "support_vectors_"):
                    metadata["support_vectors"] = model.support_vectors_.tolist()
            elif model_name == "logreg":
                # LogReg: expose linear equation weights to draw perpendiculars
                if hasattr(model, "coef_") and hasattr(model, "intercept_"):
                    metadata["weights"] = model.coef_[0].tolist()
                    metadata["bias"] = model.intercept_[0]

            # 📐 Range (for frontend scaling)
            x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
            y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5

            # ⚡ faster updates
            await asyncio.sleep(0.03)

            await self.send(text_data=json.dumps({
                "epoch": epoch,
                "loss": float(loss),
                "boundary": boundary,
                "accuracy": accuracy,
                "predictions": model.predict(X).tolist() if hasattr(model, "predict") else [],
                "points": X.tolist(),
                "labels": y.tolist(),
                "metadata": metadata,
                "range": {
                    "xMin": x_min,
                    "xMax": x_max,
                    "yMin": y_min,
                    "yMax": y_max
                }
            }))