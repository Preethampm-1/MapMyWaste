
// frontend/src/App.js
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import Admin from "./Admin";
import "./index.css"; // ensure CSS file import (or App.css)

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
  const mapRef = useRef(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const res = await axios.get(backendBase + "/api/reports");
      setReports(res.data || []);
    } catch (err) {
      console.error("Error loading reports", err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!latLng) { alert("Click the map to pick a location."); return; }
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("latitude", latLng[0]);
    fd.append("longitude", latLng[1]);
    if (form.image) fd.append("image", form.image);

    try {
      await axios.post(backendBase + "/api/reports", fd);
      setForm({ title: "", description: "", image: null });
      setLatLng(null);
      loadReports();
      alert("Report saved!");
    } catch (err) {
      console.error("Submit error", err);
      alert("Submit failed: " + (err.response?.data?.error || err.message));
    }
  }

  // marker color based on status
  function iconForStatus(status) {
    const color = status === "resolved" ? "green" : (status === "in-progress" ? "orange" : "red");
    return new L.DivIcon({
      className: "custom-marker",
      html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid white;"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  // Admin route handler
  function handleRouteCreated(route) {
    const poly = route.map(p => [p.latitude, p.longitude]);
    setRoutePolyline(poly);
    // optionally close admin: handled by Admin caller
  }

  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ display: "inline-block", marginRight: 12 }}>MapMyWaste</h2>
      <button onClick={() => setShowAdmin(true)} style={{ marginLeft: 8 }}>Admin</button>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={[20, 0]} zoom={2} style={{ height: 560 }} whenCreated={map => (mapRef.current = map)}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationSelector setLatLng={setLatLng} />

            {latLng && <Marker position={latLng}><Popup>Selected location</Popup></Marker>}

            {reports.map(r => (
              <Marker key={r.id} position={[r.latitude, r.longitude]} icon={iconForStatus(r.status)}>
                <Popup>
                  <b>{r.title || "Report"}</b><br/>
                  {r.description}<br/>
                  <small>Status: {r.status}</small><br/>
                  {r.image_url && <img src={backendBase + r.image_url} alt="" style={{width:150, marginTop:6}}/>}
                </Popup>
              </Marker>
            ))}

            {routePolyline && <Polyline positions={routePolyline} />}
            {routePolyline && <FitBounds positions={routePolyline} />}
          </MapContainer>
        </div>

        <div style={{ width: 340 }}>
          <form onSubmit={handleSubmit}>
            <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={{width:"100%"}} /><br/><br/>
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{width:"100%", height:80}} /><br/>
            <input type="file" onChange={e => setForm({ ...form, image: e.target.files[0] })} accept="image/*"/><br/><br/>
            <p>Click the map to choose a location. Selected: {latLng ? latLng.join(", ") : "none"}</p>
            <button type="submit">Submit Report</button>
          </form>
        </div>
      </div>

      {/* Slide-out admin drawer */}
      <div className={`admin-drawer ${showAdmin ? "open" : ""}`}>
        <Admin backendBase={backendBase} onClose={() => setShowAdmin(false)} onRouteCreated={handleRouteCreated} />
      </div>
    </div>
  );
}

export default App;
