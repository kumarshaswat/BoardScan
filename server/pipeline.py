import cv2
import json
import os
import numpy as np
import uuid
import base64
import vtracer
from ultralytics import YOLO

# config
MODEL_PATH = "best.pt"
OUTPUT_FILE = "whiteboard_digital.excalidraw"


# Handles numpy int32/float32 types that are not natively JSON serializable.
class NumpyEncoder(json.JSONEncoder):

    def default(self, o):
        # Convert numpy scalar and array types to JSON serializable Python types.
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        return super().default(o)


# Load model once globally when pipeline is imported
print("Loading YOLO model in pipeline...")
model = YOLO(MODEL_PATH)
print("Model loaded.")


# Remove boxes that are mostly contained inside larger boxes.
def filter_contained_boxes(boxes, overlap_threshold=0.8):
    boxes = sorted(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
    keep = []
    for box in boxes:
        x1, y1, x2, y2, cls_id, conf = box
        area = (x2 - x1) * (y2 - y1)
        is_contained = False
        for k_box in keep:
            kx1, ky1, kx2, ky2, k_cls, k_conf = k_box
            ix1, iy1 = max(x1, kx1), max(y1, ky1)
            ix2, iy2 = min(x2, kx2), min(y2, ky2)
            if ix1 < ix2 and iy1 < iy2:
                inter_area = (ix2 - ix1) * (iy2 - iy1)
                if inter_area / area > overlap_threshold:
                    is_contained = True
                    break
        if not is_contained:
            keep.append(box)
    return keep


# Process an image, extract strokes, convert them to Excalidraw SVG elements, and save the output.
def run_pipeline(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Could not read image")

    # 1280 resolution fix for thin markers
    results = model(img, conf=0.12, imgsz=1280)
    # results = model(img, conf=0.12, imgsz=1280, iou=0.5)

    # debug block
    annotated_img = results[0].plot()
    base_dir = os.path.dirname(os.path.abspath(__file__))
    debug_path = os.path.join(base_dir, "debug_yolo_boxes.jpg")
    cv2.imwrite(debug_path, annotated_img)
    print(f"\n📸 SAVED DEBUG IMAGE TO: {debug_path}\n")

    # Extract bounding boxes from YOLO detections
    raw_boxes = []
    for box in results[0].boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        raw_boxes.append([x1, y1, x2, y2, int(box.cls[0]), float(box.conf[0])])

    filtered_boxes = filter_contained_boxes(raw_boxes)  # filter out contained boxes

    excalidraw_elements = []  # initialize Excalidraw elements
    excalidraw_files = {}

    # Process each filtered bounding box to extract and convert individual characters/strokes to SVG images for Excalidraw elements
    for box in filtered_boxes:
        x1, y1, x2, y2, cls_id, conf = box
        if x2 - x1 < 15 or y2 - y1 < 15:
            continue  # skip small boxes

        crop = img[y1:y2, x1:x2]  # crop bounding box from image
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)  # convert to grayscale

        ink_mask = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 5
        )  # create ink mask via thresholding

        dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        ink_mask = cv2.dilate(
            ink_mask, dilate_kernel, iterations=1
        )  # dilate to connect nearby pixels
        ink_mask = cv2.morphologyEx(
            ink_mask, cv2.MORPH_CLOSE, close_kernel, iterations=1
        )  # morphological close to fill small gaps

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
            ink_mask, connectivity=8
        )  # find connected components in mask
        stroke_color = (
            "#0000ff" if cls_id == 0 else "#000000"
        )  # blue for markers, black for pens

        for i in range(1, num_labels):
            cx, cy, cw, ch, area = map(int, stats[i])
            if area < 15 or cw < 3 or ch < 3:
                continue  # skip small or thin components

            char_mask = (labels == i).astype(
                np.uint8
            ) * 255  # extract mask for this component
            char_crop = char_mask[cy : cy + ch, cx : cx + cw]  # crop the component
            char_img = cv2.bitwise_not(
                char_crop
            )  # invert colors (black on white to white on black)

            pad = 4
            char_img = cv2.copyMakeBorder(
                char_img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=255
            )  # add white padding around image

            scale_factor = 3
            char_img = cv2.resize(
                char_img,
                None,
                fx=scale_factor,
                fy=scale_factor,
                interpolation=cv2.INTER_CUBIC,
            )  # upscale image for better vectorization
            char_img = cv2.GaussianBlur(
                char_img, (9, 9), 0
            )  # apply blur to smooth edges
            _, char_img = cv2.threshold(
                char_img, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU
            )  # binarize with Otsu's method

            abs_x = x1 + cx - pad  # calculate absolute x position
            abs_y = y1 + cy - pad  # calculate absolute y position
            abs_w = cw + (pad * 2)  # calculate width with padding
            abs_h = ch + (pad * 2)  # calculate height with padding

            unique_id = uuid.uuid4().hex[:6]
            temp_png = f"/tmp/char_{abs_x}_{abs_y}_{unique_id}.png"
            temp_svg = f"/tmp/stroke_{abs_x}_{abs_y}_{unique_id}.svg"

            cv2.imwrite(temp_png, char_img)  # save processed image as temp PNG

            try:
                vtracer.convert_image_to_svg_py(  # convert PNG to SVG using vtracer
                    temp_png,
                    temp_svg,
                    colormode="binary",
                    hierarchical="cutout",
                    mode="spline",
                    filter_speckle=10,
                    color_precision=6,
                    layer_difference=16,
                    corner_threshold=120,
                    length_threshold=3.5,
                    max_iterations=10,
                    splice_threshold=45,
                    path_precision=3,
                )
            except Exception as e:
                print(f"vtracer failed at ({abs_x},{abs_y}): {e}")
                if os.path.exists(temp_png):
                    os.remove(temp_png)
                continue

            if os.path.exists(temp_png):
                os.remove(temp_png)  # clean up temp PNG
            if not os.path.exists(temp_svg):
                continue

            with open(temp_svg, "r") as f:
                svg_data = f.read()  # read SVG content

            if os.path.exists(temp_svg):
                os.remove(temp_svg)  # clean up temp SVG

            svg_data = svg_data.replace(
                "<svg ", f'<svg style="fill: {stroke_color};" '
            )  # set fill color in SVG
            b64_data = base64.b64encode(svg_data.encode("utf-8")).decode("utf-8")
            data_url = (
                f"data:image/svg+xml;base64,{b64_data}"  # encode SVG as base64 data URL
            )

            file_id = str(uuid.uuid4())

            excalidraw_elements.append(  # add image element to Excalidraw elements
                {
                    "id": file_id,
                    "type": "image",
                    "x": abs_x,
                    "y": abs_y,
                    "width": abs_w,
                    "height": abs_h,
                    "angle": 0,
                    "strokeColor": "transparent",
                    "backgroundColor": "transparent",
                    "fillStyle": "hachure",
                    "strokeWidth": 1,
                    "strokeStyle": "solid",
                    "roughness": 1,
                    "opacity": 100,
                    "groupIds": [],
                    "roundness": None,
                    "isDeleted": False,
                    "boundElements": None,
                    "updated": 1,
                    "link": None,
                    "locked": False,
                    "fileId": file_id,
                    "status": "saved",
                }
            )

            excalidraw_files[file_id] = {  # add file entry to Excalidraw files
                "mimeType": "image/svg+xml",
                "id": file_id,
                "dataURL": data_url,
                "created": 1,
                "lastRetrieved": 1,
            }

    # If there are any Excalidraw elements, normalize their positions so the top-left corner of the whole drawing starts at (0, 0) before exporting.
    if excalidraw_elements:
        min_x = min(el["x"] for el in excalidraw_elements)
        min_y = min(el["y"] for el in excalidraw_elements)
        for el in excalidraw_elements:
            el["x"] -= min_x
            el["y"] -= min_y

    # Build the Excalidraw JSON object with the extracted elements and files
    excalidraw_data = {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": excalidraw_elements,
        "appState": {"viewBackgroundColor": "#ffffff"},
        "files": excalidraw_files,
    }

    # saves a local copy for debugging
    with open(OUTPUT_FILE, "w") as f:
        json.dump(excalidraw_data, f, cls=NumpyEncoder)
    print(f"📁 Local debug file saved as {OUTPUT_FILE}")

    return excalidraw_data


# allows running the pipeline locally with a test image for quick debugging
if __name__ == "__main__":
    test_image = "whiteboard_photo.jpg"
    if os.path.exists(test_image):
        run_pipeline(test_image)
    else:
        print(f"To test locally, place a '{test_image}' in this folder.")
