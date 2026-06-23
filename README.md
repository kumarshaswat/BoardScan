<img width="465" height="128" alt="boardscan_text" src="https://github.com/user-attachments/assets/ec1c56e1-d588-4c64-9aa3-e95c0bcb3a03" />

## I solved the "Analog Data Loss" problem.

BoardScan was developed to stop valuable ideas from being left behind on whiteboards. Every day, in classrooms and meeting rooms everywhere, valuable ideas get left on a whiteboard. Often, the default solution is to take a picture on a phone. However, 90% of the time, the result ends up blurry, washed out by glare, or completely static—you cannot edit it, scale it, or extract meaningful data from it. 

My mission was to solve that end-to-end. BoardScan allows you to take a standard whiteboard photo and have it come out the other side as a fully functional digital canvas where every element is individually editable, movable, and rewritable. 

**Developed by:** Shaz Kumar

---

## 🎥 Video Demo


https://github.com/user-attachments/assets/50c3fb4c-2ad6-4abb-94c1-f0264ae10f3e


---

## 🧠 The Architecture & Workflow

BoardScan uses a three-step pipeline combining a Mobile UI, a Computer Vision extraction process, and a fine-tuned Object Detection model.

### The Pipeline Perspective
1. **Mobile Capture:** The process starts on the phone with the user capturing a high-resolution photo through the React Native/Expo mobile interface.
2. **Secure Transmission:** That image is transmitted securely through an `ngrok` tunnel to a local Flask server running on my hardware.
3. **Inference & Processing:** The server runs the YOLO detection pass, applies the OpenCV extraction, and hands the result off to VTracer.
4. **Vector Delivery:** The output is an Excalidraw JSON file—a fully editable, vector-based digital board—delivered directly back to the phone.

### The Engine Details
* **Character Detection (YOLOv26-Medium):** YOLO detects where the writing and shapes are located on the board.
* **OpenCV Pipeline:** Once localized, an OpenCV pipeline cleans up each region using Adaptive Thresholding, Otsu’s binarization method, and Gaussian Blur to separate the ink from board glare, even for faint marker strokes.
* **VTracer Engine:** A specialized path-fitting algorithm translates those cleaned-up, binarized ink blobs into smooth, digital-first SVG spline paths that act like real digital strokes.

---

## 📊 Model Training & Dataset

The foundation of any Computer Vision project is data. I built a custom annotated dataset through Roboflow, focused specifically on real whiteboard conditions: faint marker strokes, uneven lighting, and severe board glare.

* **Dataset Scope:** I started with 100 manually annotated images and utilized data augmentation to scale up to 300 training samples across two classes: *handwriting* and *shapes*.
* **Augmentation Strategy:** Horizontal flipping was strictly disabled (fliplr=0.0) to avoid mirroring text logic and corrupting the handwriting class.
* **Resolution:** Standardized at 640x640, providing the ideal balance between capturing fine text detail and keeping inference smooth on local hardware.
* **Why YOLOv26-Medium?** 1. **NMS-Free Design:** It is built to skip the Non-Maximum Suppression (NMS) post-processing step that most detection models rely on, resulting in faster and cleaner results straight out of the model.
  2. **MuSGD Optimizer:** It utilizes a smarter default optimizer (a hybrid of SGD + Muon) designed to provide more stable training on whiteboard data without requiring heavy manual tuning, reducing engineering overhead.

---

## 📈 Results & Evaluation

During training, the model learned rapidly—transitioning from zero knowledge to reliably detecting whiteboard content within the first 20 epochs before leveling off. 

* **Peak Accuracy:** The best checkpoint was achieved at epoch 40, hitting a **40.3% detection accuracy (mAP)**. 
* **Loss Curves:** Both training and validation loss dropped sharply early on and plateaued together. This indicates successful learning and generalization, rather than just memorizing the training data.
* **Context:** Achieving a 40.3% mAP from a highly specific, custom domain of only 100 hand-annotated base images is a strong, honest result that demonstrates clear potential for scaling with a larger dataset.

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

---

## 📑 Project Presentation

To view the full pitch and visual breakdown of the BoardScan project, check out the presentation slides here:  
[BoardScan Presentation (Google Slides)](https://docs.google.com/presentation/d/11GD0ydtVrBeEiUg9gRFEH7rOZJ3n7AksFxMk2HO8SFs/edit?slide=id.p11#slide=id.p11)
