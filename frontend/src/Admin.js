// frontend/src/Admin.js
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

export default function Admin({
  backendBase,
  onClose,
  onRouteCreated,
  onDataChanged,
  refreshKey,
}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter & search state
  const [filter, setFilter] = useState("all"); // all | open | resolved
  const [search, setSearch] = useState("");

  const loadReports = useCallback(async () => {
    const res = await axios.get(`${backendBase}/api/reports`);
    setReports(res.data || []);
  }, [backendBase]);

  useEffect(() => {
    loadReports();
  }, [loadReports, refreshKey]);

  async function removeReport(id) {
    if (!window.confirm("Delete report?")) return;
    await axios.delete(`${backendBase}/api/reports/${id}`);
    loadReports();
    onDataChanged();
  }

  async function markResolved(id) {
    await axios.post(`${backendBase}/api/reports/${id}/status`, {
      status: "resolved",
    });
    loadReports();
    onDataChanged();
  }

  async function createRoute() {
    const open = reports.filter(r => r.status !== "resolved");
    if (open.length < 2) {
      alert("Need at least 2 unresolved reports.");
      return;
    }

    setLoading(true);
    const res = await axios.post(`${backendBase}/api/route`);
    onRouteCreated(res.data.route || []);
    setLoading(false);
    onClose();
  }

  /* ===== Dashboard Counts ===== */
  const totalCount = reports.length;
  const openCount = reports.filter(r => r.status !== "resolved").length;
  const resolvedCount = reports.filter(r => r.status === "resolved").length;

  /* ===== Filter + Search Logic ===== */
  const visibleReports = reports.filter(r => {
    if (filter === "open" && r.status === "resolved") return false;
    if (filter === "resolved" && r.status !== "resolved") return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="panel">
      <h2>🛠️ Admin Dashboard</h2>

      {/* ===== Counts ===== */}
      <div
        className="dashboard-row"
        style={{ display: "flex", gap: 12, marginBottom: 16 }}
      >
        <div className="panel" style={{ flex: 1 }}>
          <h4>Total Reports</h4>
          <div style={{ fontSize: 22, fontWeight: "bold" }}>{totalCount}</div>
        </div>

        <div className="panel" style={{ flex: 1 }}>
          <h4>Open</h4>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#dc2626" }}>
            {openCount}
          </div>
        </div>

        <div className="panel" style={{ flex: 1 }}>
          <h4>Resolved</h4>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#16a34a" }}>
            {resolvedCount}
          </div>
        </div>
      </div>

      {/* ===== Actions ===== */}
      <div style={{ marginBottom: 12 }}>
        <button
          className="primary"
          onClick={createRoute}
          disabled={loading || openCount < 2}
        >
          {loading ? "Creating Route..." : "🚛 Generate Collection Route"}
        </button>

        <button
          className="danger"
          onClick={onClose}
          style={{ marginLeft: 8 }}
        >
          Close
        </button>

        {openCount < 2 && (
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            At least 2 open reports are required to generate a route.
          </p>
        )}
      </div>

      {/* ===== Filters + Search ===== */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          className={filter === "all" ? "primary" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          className={filter === "open" ? "primary" : ""}
          onClick={() => setFilter("open")}
        >
          Open
        </button>
        <button
          className={filter === "resolved" ? "primary" : ""}
          onClick={() => setFilter("resolved")}
        >
          Resolved
        </button>

        <input
          type="text"
          placeholder="Search by title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>

      {/* ===== Reports Table ===== */}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Image</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {visibleReports.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.title}</td>

              <td>
                {r.status === "resolved" ? (
                  <span className="badge-resolved">Resolved</span>
                ) : (
                  <span className="badge-open">Open</span>
                )}
              </td>

              {/* ===== IMAGE COLUMN ===== */}
              <td>
                {r.image_filename ? (
                  <a
                    href={`${backendBase}/uploads/${r.image_filename}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <button className="primary">View</button>
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    No Image
                  </span>
                )}
              </td>

              {/* ===== ACTIONS ===== */}
              <td>
                {r.status !== "resolved" && (
                  <button
                    className="success"
                    onClick={() => markResolved(r.id)}
                    style={{ marginRight: 6 }}
                  >
                    Resolve
                  </button>
                )}
                <button
                  className="danger"
                  onClick={() => removeReport(r.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}

          {visibleReports.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", color: "#6b7280" }}>
                No matching reports
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
