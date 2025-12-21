// frontend/src/App.js
import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Polyline,
  useMap
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import Admin from "./Admin";
import "./index.css";

// Fix Leaflet default icon paths (CRA)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const backendBase = "http://127.0.0.1:5000";

function LocationSelector({ setLatLng }) {
  useMapEvents({
    click(e) {
      setLatLng([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length) {
      map.fitBounds(positions);
    }
  }, [positions, map]);
  return null;
}

function App() {
  const [reports, setReports] = useState([]);
  const [latLng, setLatLng] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", image: null });
  const [showAdmin, setShowAdmin] = useState(false);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [adminRefreshKey, setAdminRefreshKey] = useState(0);
  const mapRef = useRef(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    const res = await axios.get(`${backendBase}/api/reports`);
    setReports(res.data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!latLng) {
      alert("Click the map to pick a location.");
      return;
    }

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("latitude", latLng[0]);
    fd.append("longitude", latLng[1]);
    if (form.image) fd.append("image", form.image);

    await axios.post(`${backendBase}/api/reports`, fd);

    setForm({ title: "", description: "", image: null });
    setLatLng(null);

    loadReports();
    setAdminRefreshKey(k => k + 1);

    alert("Report saved!");
  }

  function iconForStatus(status) {
    const color = status === "resolved" ? "green" : "red";
    return new L.DivIcon({
      className: "custom-marker",
      html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid white;"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  function handleRouteCreated(route) {
    const poly = route.map(p => [p.latitude, p.longitude]);
    setRoutePolyline(null);
    setTimeout(() => setRoutePolyline([...poly]), 0);
  }

  return (
    <div className="app-root">
      <div className="app-header">
        <h2>MapMyWaste</h2>
        <button onClick={() => setShowAdmin(true)}>Admin</button>
      </div>

      {/* ===== MAIN LAYOUT ===== */}
      <div className="main-layout">
        {/* ===== MAP ===== */}
        <div className="map-wrapper">
          <MapContainer
            key={`${reports.length}-${routePolyline ? routePolyline.length : 0}`}
            center={[20, 0]}
            zoom={2}
            whenCreated={map => (mapRef.current = map)}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationSelector setLatLng={setLatLng} />

            {latLng && (
              <Marker position={latLng}>
                <Popup>Selected</Popup>
              </Marker>
            )}

            {reports.map(r => (
              <Marker
                key={r.id}
                position={[r.latitude, r.longitude]}
                icon={iconForStatus(r.status)}
              >
                <Popup>
                  <b>{r.title}</b><br />
                  {r.description}<br />
                  <small>Status: {r.status}</small>
                </Popup>
              </Marker>
            ))}

            {routePolyline && (
              <>
                <Polyline positions={routePolyline} />
                <FitBounds positions={routePolyline} />
              </>
            )}
          </MapContainer>
        </div>

        {/* ===== FORM ===== */}
        <div className="form-wrapper panel">
          <form onSubmit={handleSubmit}>
            <input
              placeholder="Title"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />

            <input
              type="file"
              accept="image/*"
              onChange={e => setForm({ ...form, image: e.target.files[0] })}
            />

            <button type="submit" className="primary">
              Submit Report
            </button>
          </form>
        </div>
      </div>

      {/* ===== ADMIN ===== */}
      {showAdmin && (
        <div className="admin-drawer open">
          <Admin
            backendBase={backendBase}
            onClose={() => setShowAdmin(false)}
            onRouteCreated={handleRouteCreated}
            onDataChanged={loadReports}
            refreshKey={adminRefreshKey}
          />
        </div>
      )}
    </div>
  );
}

export default App;
