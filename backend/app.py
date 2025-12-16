# backend/app.py

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename
import os
import time
import uuid
import math

from models import db, Report
import config

print("RUNNING FILE:", __file__)

# ---------------- Configuration ----------------

ALLOWED_EXT = {"png", "jpg", "jpeg", "gif"}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


# ---------------- App Setup ----------------

app = Flask(__name__)
app.config.from_object(config)

app.config.setdefault("UPLOAD_FOLDER", os.path.join(os.getcwd(), "uploads"))
app.config.setdefault("MAX_CONTENT_LENGTH", MAX_CONTENT_LENGTH)

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

CORS(app)
db.init_app(app)

with app.app_context():
    db.create_all()

print("DEBUG: Flask initialized & DB ready.")


# ---------------- API ROUTES ----------------

# CREATE REPORT
@app.route("/api/reports", methods=["POST", "OPTIONS"])
@cross_origin()
def create_report():
    # Preflight
    if request.method == "OPTIONS":
        return jsonify({}), 200

    try:
        title = request.form.get("title", "")
        description = request.form.get("description", "")
        lat = float(request.form["latitude"])
        lon = float(request.form["longitude"])
    except Exception as e:
        return jsonify({"error": "Invalid data", "details": str(e)}), 400

    # File upload
    file = request.files.get("image")
    filename = None

    if file and file.filename:
        if not allowed_file(file.filename):
            return jsonify({"error": "file type not allowed"}), 400

        safe_name = secure_filename(file.filename)
        unique_name = f"{int(time.time())}_{uuid.uuid4().hex}_{safe_name}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)

        try:
            file.save(save_path)
            filename = unique_name
        except Exception as e:
            return jsonify({"error": "failed to save file", "details": str(e)}), 500

    # Save report
    new_report = Report(
        title=title,
        description=description,
        latitude=lat,
        longitude=lon,
        image_filename=filename,
        status="open"
    )

    db.session.add(new_report)
    db.session.commit()

    return jsonify({"message": "Report created", "id": new_report.id}), 201


# LIST REPORTS
@app.route("/api/reports", methods=["GET"])
@cross_origin()
def list_reports():
    reports = Report.query.order_by(Report.created_at.desc()).all()

    return jsonify([
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "image_url": f"/uploads/{r.image_filename}" if r.image_filename else None,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in reports
    ])


# SERVE UPLOADED FILES
@app.route("/uploads/<path:filename>")
@cross_origin()
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


# UPDATE STATUS
@app.route("/api/reports/<int:report_id>/status", methods=["POST", "OPTIONS"])
@cross_origin()
def update_status(report_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json(silent=True)
    if not data or "status" not in data:
        return jsonify({"error": "status required"}), 400

    report = Report.query.get(report_id)
    if not report:
        return jsonify({"error": "not found"}), 404

    report.status = data["status"]
    db.session.commit()

    return jsonify({"message": "status updated", "id": report.id, "status": report.status})


# DELETE REPORT
@app.route("/api/reports/<int:report_id>", methods=["DELETE", "OPTIONS"])
@cross_origin()
def delete_report(report_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    report = Report.query.get(report_id)
    if not report:
        return jsonify({"error": "not found"}), 404

    # delete file from disk if exists
    if report.image_filename:
        path = os.path.join(app.config["UPLOAD_FOLDER"], report.image_filename)
        if os.path.exists(path):
            try:
                os.remove(path)
            except:
                pass

    db.session.delete(report)
    db.session.commit()

    return jsonify({"message": "deleted", "id": report_id})


# HELPER
def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


# ROUTE GENERATOR (MVP)
@app.route("/api/route", methods=["POST", "OPTIONS"])
@cross_origin()
def compute_route():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.get_json(silent=True) or {}
    ids = data.get("report_ids")

    if ids:
        points = [Report.query.get(i) for i in ids if Report.query.get(i)]
    else:
        points = Report.query.filter(Report.status != "resolved").all()

    if not points:
        return jsonify({"route": []})

    coords = [(r.latitude, r.longitude, r.id) for r in points]
    route = []

    cur = (coords[0][0], coords[0][1])
    remaining = coords.copy()

    while remaining:
        next_pt = min(remaining, key=lambda p: _dist(cur, (p[0], p[1])))
        route.append({"id": next_pt[2], "latitude": next_pt[0], "longitude": next_pt[1]})
        remaining.remove(next_pt)
        cur = (next_pt[0], next_pt[1])

    return jsonify({"route": route})


# ---------------- Run Flask Server ----------------

if __name__ == "__main__":
    print("ROUTES:", [str(rule) + " -> " + rule.endpoint for rule in app.url_map.iter_rules()])
    print("DEBUG: Starting server...")
    app.run(debug=True)
