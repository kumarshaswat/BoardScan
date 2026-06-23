from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import json

# Import pipeline logic and encoder
from pipeline import run_pipeline, NumpyEncoder

# This server wraps the processing pipeline so clients can upload images
# and receive JSON results over HTTP.
app = Flask(__name__)
CORS(app)


# Health check endpoint
@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200


# Process image upload
@app.route("/process", methods=["POST"])
def process():
    image_file = request.files.get("image")
    if not image_file:
        return jsonify({"error": "No image provided"}), 400

    # Save image to temp file
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        image_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        # Run pipeline on image
        result = run_pipeline(tmp_path)

        # Return result as JSON
        return app.response_class(
            response=json.dumps(result, cls=NumpyEncoder), mimetype="application/json"
        )
    except Exception as e:
        print(f"Pipeline error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Remove temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
