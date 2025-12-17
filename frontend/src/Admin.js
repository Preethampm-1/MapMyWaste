
// frontend/src/Admin.js
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

export default function Admin({ backendBase, onClose, onRouteCreated }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  // ----------------------------
  // Load all reports (memoized)
  // ----------------------------
  const loadReports = useCallback(async () => {
    try {
      const res = await axios.get(`${backendBase}/api/reports`);
      setReports(res.data || []);
    } catch (err) {
      console.error("Failed to load reports:", err);
      alert("Failed to load reports. See console.");
    }
  }, [backendBase]);

  // Load reports on component mount
  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // -----------------------------------
  // Delete report
  // -----------------------------------
  async function removeReport(id) {
    if (!window.confirm(`Delete report ${id}?`)) return;

    try {
      await axios.delete(`${backendBase}/api/reports/${id}`);
      loadReports();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete report.");
    }
  }

  // -----------------------------------
  // Mark report as resolved
  // -----------------------------------
  async function markResolved(id) {
    try {
      await axios.post(`${backendBase}/api/reports/${id}/status`, {
        status: "resolved",
      });
      loadReports();
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status.");
    }
  }

  // -----------------------------------
  // Create optimized route
  // -----------------------------------
  async function createRoute() {
    setLoading(true);

    try {
      const res = await axios.post(`${backendBase}/api/route`, {});
      const route = res.data.route || [];

      if (!route.length) {
        alert("No open reports available to create route.");
        setLoading(false);
        return;
      }

      // Send route back to App.js
      onRouteCreated(route);

      // Close panel
      onClose();
    } catch (err) {
      console.error("Route creation failed:", err);
      alert("Failed to create route.");
    }

    setLoading(false);
  }

  // -----------------------------------
  // RENDER
  // -----------------------------------
  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>Admin Panel</h3>

        <div>
          <button onClick={createRoute} disabled={loading} style={{ marginRight: 8 }}>
            {loading ? "Creating..." : "Create Route"}
          </button>

          <button onClick={onClose}>Close</button>
        </div>
      </div>

      {/* Reports Table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <th>ID</th>
            <th>Title</th>
            <th>Lat</th>
            <th>Lon</th>
            <th>Status</th>
            <th>Image</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {reports.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{r.id}</td>
              <td>{r.title || "Untitled"}</td>
              <td>{Number(r.latitude).toFixed(5)}</td>
              <td>{Number(r.longitude).toFixed(5)}</td>
              <td>{r.status}</td>

              {/* Image link */}
              <td>
                {r.image_url ? (
                  <a href={backendBase + r.image_url} target="_blank" rel="noreferrer">
                    view
                  </a>
                ) : (
                  "—"
                )}
              </td>

              {/* Action buttons */}
              <td>
                {r.status !== "resolved" && (
                  <button
                    onClick={() => markResolved(r.id)}
                    style={{ marginRight: 6 }}
                  >
                    Mark Resolved
                  </button>
                )}

                <button
                  onClick={() => removeReport(r.id)}
                  style={{ background: "#d9534f", color: "white" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}

          {reports.length === 0 && (
            <tr>
              <td colSpan="7" style={{ padding: 10 }}>
                No reports available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
