# 🌍 MapMyWaste

MapMyWaste is a full-stack web application designed to improve urban waste management by enabling citizens to report waste issues and helping municipal authorities optimize waste collection routes.

The platform integrates real-time geotagged reporting, interactive map visualization, and intelligent route optimization to support cleaner and smarter cities.

---

## 🚀 Features

### 👤 User Features
- Submit waste reports with:
  - Title & description
  - Image upload
  - Location selection on map
- View all reported waste locations on an interactive map
- See report status (open / resolved)

### 🛠️ Admin Features
- View all waste reports
- Delete reports
- Mark reports as resolved
- Generate optimized waste collection routes
- Visualize routes directly on the map

---

## 🧱 Tech Stack

### Frontend
- React
- Leaflet (maps)
- Axios
- HTML, CSS, JavaScript

### Backend
- Python
- Flask
- Flask-CORS
- SQLAlchemy

### Database
- SQLite (development)
- PostgreSQL (production-ready)

### File Storage
- Local file system (development)
- Cloud storage ready (AWS S3 / Render)

---

## 📁 Project Structure

MapMyWaste/
│
├── backend/
│ ├── app.py
│ ├── models.py
│ ├── config.py
│ ├── requirements.txt
│ └── uploads/
│ └── .gitkeep
│
├── frontend/
│ ├── public/
│ └── src/
│ ├── App.js
│ ├── Admin.js
│ └── index.js
│
├── inspect_db.py
├── .gitignore

🚀 Possible Next Steps

Deploy to Render (backend + frontend)

Switch to PostgreSQL + cloud image storage

Add authentication for admin actions

Convert frontend to PWA (installable app)[optional]

UI/UX polish and filters

Analytics & waste hotspot detection
