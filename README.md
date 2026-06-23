
# BoardScan: Whiteboard to Vectorization 🖍️✨

**Digitizing Hand-Drawn Intelligence.** BoardScan was developed to solve the "Analog Data Loss" problem. During brainstorming, valuable insights are often left on whiteboards or captured in low-quality photos that cannot be edited or scaled. 

This project is a complete end-to-end pipeline—from handheld mobile capture to clean, vector-based digital assets—preserving the organic feel of handwriting while enabling modern digital flexibility.

**Developed by:** Shaz Kumar

---

## 🎥 Video Demo

[![BoardScan Demo](./assets/demo.mp4)](https://github.com/user-attachments/assets/d1b8bbb7-8382-4a39-b055-d943bb91477d)

---

## 🧠 The Architecture

BoardScan uses a multi-stage pipeline combining Mobile UI, Computer Vision, and a fine-tuned Object Detection model.

### 1. Mobile Frontend (React Native / Expo)
- A streamlined iOS/Android interface allowing users to upload high-resolution whiteboard photos.
- Communicates with the backend via an `ngrok` tunnel for secure, local network processing.

### 2. Backend Server (Flask)
- Executes the YOLO detection and CV binarization pipeline.
- Returns a fully editable Excalidraw JSON asset.

### 3. The Inference Workflow
- **OpenCV Pipeline:** A multi-stage extraction using Adaptive Thresholding, Otsu's binarization, and Gaussian Blur to isolate ink from board glare.
- **Character Detection (YOLOv26-Medium):** A 20.4M parameter model optimized for Metal Performance Shaders (MPS), providing sub-50ms inference.
- **VTracer Engine:** A specialized path-fitting algorithm that translates binarized ink blobs into smooth, digital-first SVG spline paths.

---

## 📊 Model Training & Dataset

The YOLOv26-Medium model was fine-tuned specifically for the whiteboard domain.

* **Dataset:** Built and annotated via Roboflow, focusing on whiteboard handwriting and symbols. Included diverse samples ranging from thin light-blue markers to thick black permanent markers.
* **Augmentation:** Horizontal flipping was disabled (fliplr=0.0) to avoid mirroring text logic.
* **Resolution:** Standardized at 640x640 to capture text boundaries.
* **Optimization:** Utilized the MuSGD optimizer (a hybrid of SGD + Muon), delivering more stable convergence than AdamW on whiteboard data.
* **Performance:** Achieved an NMS-free end-to-end design, eliminating post-processing latency and running at sub-50ms on Apple M4 Metal MPS.

---

## 🚀 Getting Started

### 1. Start the Mobile App (Frontend)

Navigate to the `app/` directory and install the Expo dependencies:

```bash
cd app
npm install
npx expo start
```

*Scan the QR code with the Expo Go app (iOS/Android) to launch BoardScan.*

### 2. Start the Inference Server (Backend)

The pipeline server must be reachable over the local network and expose `/health` and `/process` endpoints. 

```bash
cd server
pip install -r requirements.txt
python app.py
```

*Ensure the server runs on `0.0.0.0` (not `127.0.0.1`) to be reachable from your mobile device.*

### 3. Connect App to Server

1. Open the **BoardScan** app on your phone.
2. Navigate to **Settings**.
3. Enter your computer's **local IP address** (e.g., `192.168.1.42`) and port `5000`.
4. Tap **Test Connection** to verify everything is working.

---

## 🛠️ Troubleshooting

* **"Could not reach the server":** Make sure your phone and computer are on the same Wi-Fi network. Check the IP is correct and that your server is running with `host='0.0.0.0'`. Verify your firewall isn't blocking the port.
* **Editor shows blank / "Loading editor..." forever:** The Excalidraw editor loads from CDN (`unpkg.com`)—the phone needs active internet access.
* **Scene loads but elements are missing:** Make sure your pipeline response matches the Excalidraw JSON format and that `elements` is an array.
* **Save button doesn't do anything:** Wait for the editor to fully load (loading overlay disappears) before saving.
