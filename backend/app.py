# backend/app.py

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import time
import uuid
import math

from models import db, Report
import config

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
@app.route("/api/reports", methods=["POST"])
def create_report():
    try:
        title = request.form.get("title", "")
        description = request.form.get("description", "")
        lat = float(request.form["latitude"])
        lon = float(request.form["longitude"])
    except Exception as e:
        return jsonify({"error": "Invalid data", "details": str(e)}), 400

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

    return jsonify({
        "message": "Report created",
        "id": new_report.id
    }), 201


# LIST REPORTS (🔴 FIXED IMAGE FIELD)
@app.route("/api/reports", methods=["GET"])
def list_reports():
    reports = Report.query.order_by(Report.created_at.desc()).all()

    return jsonify([
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "latitude": r.latitude,
            "longitude": r.longitude,

            # 🔴 IMPORTANT: frontend expects this
            "image_filename": r.image_filename,

            # optional helper field
            "image_url": f"/uploads/{r.image_filename}" if r.image_filename else None,

            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in reports
    ])


# SERVE UPLOADED FILES
@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


# MARK REPORT AS RESOLVED
@app.route("/api/reports/<int:report_id>/status", methods=["POST"])
def update_status(report_id):
    data = request.get_json(silent=True)

    if not data or "status" not in data:
        return jsonify({"error": "status required"}), 400

    report = Report.query.get_or_404(report_id)

    report.status = data["status"]
    db.session.commit()

    return jsonify({
        "message": "status updated",
        "id": report.id,
        "status": report.status
    })


# DELETE REPORT
@app.route("/api/reports/<int:report_id>", methods=["DELETE"])
def delete_report(report_id):
    report = Report.query.get_or_404(report_id)

    if report.image_filename:
        path = os.path.join(app.config["UPLOAD_FOLDER"], report.image_filename)
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

    db.session.delete(report)
    db.session.commit()

    return jsonify({
        "message": "deleted",
        "id": report_id
    })


# ---------------- ROUTE GENERATION ----------------

def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


@app.route("/api/route", methods=["POST"])
def compute_route():
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
        route.append({
            "id": next_pt[2],
            "latitude": next_pt[0],
            "longitude": next_pt[1]
        })
        remaining.remove(next_pt)
        cur = (next_pt[0], next_pt[1])

    return jsonify({"route": route})


# ---------------- Run Server ----------------

if __name__ == "__main__":
    print("DEBUG: Starting Flask server...")
    app.run(debug=True)
