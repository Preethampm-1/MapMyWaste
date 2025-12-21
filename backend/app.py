# backend/app.py

import os
from dotenv import load_dotenv

# Load .env file (JWT_SECRET_KEY here)
load_dotenv()

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import time, uuid, math

from models import db, Report
import config

# ---------------- JWT AUTH IMPORTS ----------------
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity, verify_jwt_in_request, get_jwt
)
from flask_bcrypt import Bcrypt
from functools import wraps

# ---------------- App Setup ----------------

app = Flask(__name__)
app.config.from_object(config)

# JWT config
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY") or "fallback-secret"
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

CORS(app)
db.init_app(app)

with app.app_context():
    db.create_all()

print("DEBUG: Flask initialized & DB ready.")

# ---------------- USER MODEL ----------------

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")
    # role is "user" or "admin"

with app.app_context():
    db.create_all()

# ---------------- AUTH HELPERS ----------------

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()  # ensure valid token
        claims = get_jwt()
        if claims.get("role") == "admin":
            return fn(*args, **kwargs)
        return jsonify({"msg": "Admin access required"}), 403
    return wrapper

# ---------------- AUTH ROUTES ----------------

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "user")  # default role is "user"

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400

    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    new_user = User(username=username, password=hashed, role=role)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User created successfully"}), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")

    user = User.query.filter_by(username=username).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "invalid credentials"}), 401

    token = create_access_token(
        identity=user.id,
        additional_claims={"role": user.role}
    )
    return jsonify({"token": token})

# ---------------- API ROUTES ----------------

def allowed_file(filename):
    ALLOWED_EXT = {"png", "jpg", "jpeg", "gif"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

app.config.setdefault("UPLOAD_FOLDER", os.path.join(os.getcwd(), "uploads"))
app.config.setdefault("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

# Normal user & admin can create reports
@app.route("/api/reports", methods=["POST"])
@jwt_required()
def create_report():
    try:
        title = request.form.get("title", "")
        description = request.form.get("description", "")
        lat = float(request.form["latitude"])
        lon = float(request.form["longitude"])
    except Exception as e:
        return jsonify({"error": "Invalid form", "details": str(e)}), 400

    file = request.files.get("image")
    filename = None
    if file and file.filename:
        safe = secure_filename(file.filename)
        name = f"{int(time.time())}_{uuid.uuid4().hex}_{safe}"
        file.save(os.path.join(app.config["UPLOAD_FOLDER"], name))
        filename = name

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

# Anyone (no login) can view reports
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
            "image_url": f"/uploads/{r.image_filename}" if r.image_filename else None,
            "status": r.status
        }
        for r in reports
    ])

@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

# Only admin can update status
@app.route("/api/reports/<int:report_id>/status", methods=["POST"])
@admin_required
def update_status(report_id):
    data = request.get_json(silent=True)
    if not data or "status" not in data:
        return jsonify({"error": "status required"}), 400

    report = Report.query.get_or_404(report_id)
    report.status = data["status"]
    db.session.commit()
    return jsonify({"message": "status updated", "id": report.id})

# Only admin can delete
@app.route("/api/reports/<int:report_id>", methods=["DELETE"])
@admin_required
def delete_report(report_id):
    report = Report.query.get_or_404(report_id)
    if report.image_filename:
        path = os.path.join(app.config["UPLOAD_FOLDER"], report.image_filename)
        if os.path.exists(path):
            os.remove(path)
    db.session.delete(report)
    db.session.commit()
    return jsonify({"message": "deleted", "id": report_id})

# Route generation untouched
@app.route("/api/route", methods=["POST"])
def compute_route():
    data = request.get_json(silent=True) or {}
    ids = data.get("report_ids")
    if ids:
        pts = [Report.query.get(i) for i in ids if Report.query.get(i)]
    else:
        pts = Report.query.filter(Report.status != "resolved").all()
    coords = [(r.latitude, r.longitude, r.id) for r in pts]
    route = []
    cur = (coords[0][0], coords[0][1]) if coords else None
    remaining = coords.copy()
    while remaining:
        next_pt = min(remaining, key=lambda p: math.hypot(cur[0]-p[0], cur[1]-p[1]))
        route.append({"id": next_pt[2], "latitude": next_pt[0], "longitude": next_pt[1]})
        remaining.remove(next_pt)
        cur = (next_pt[0], next_pt[1])
    return jsonify({"route": route})

if __name__ == "__main__":
    app.run(debug=True)
