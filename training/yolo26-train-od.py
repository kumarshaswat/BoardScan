from roboflow import Roboflow
from ultralytics import YOLO
import os

# ── 1. Download dataset ───────────────────────────────────────────────────────
rf = Roboflow(api_key="zjPqJ6hEqXTEEZcYp0Yr")
project = rf.workspace("cv-project-pyzkg").project("whiteboard-reader-yv4mi")
dataset = project.version(3).download("yolov8")

# ── 2. Load model ─────────────────────────────────────────────────────────────
model = YOLO("yolo26m.pt")

# ── 3. Quick test run ─────────────────────────────────────────────────────────
RUN_NAME = "yolo26-medium"

results = model.train(
    data=f"{dataset.location}/data.yaml",
    epochs=300,
    patience=50,
    imgsz=640,
    batch=16,
    device="mps",
    optimizer="auto",
    amp=True,
    workers=0,
    cache="ram",
    mosaic=1.0,
    mixup=0.15,
    copy_paste=0.1,
    perspective=0.001,
    hsv_s=0.5,
    fliplr=0.0,
    flipud=0.0,
    dropout=0.1,
    weight_decay=0.0005,
    name=RUN_NAME,
    exist_ok=True,
    plots=True,
    val=True,
)

# ── 4. Quick validation ───────────────────────────────────────────────────────
path_to_weights = f"runs/detect/{RUN_NAME}/weights/best.pt"

if os.path.exists(path_to_weights):
    best_model = YOLO(path_to_weights)
    best_model.predict(
        source=f"{dataset.location}/valid/images",
        conf=0.15,
        iou=0.5,
        save=True,
    )
    print(f"Detections saved to: {best_model.predictor.save_dir}")
