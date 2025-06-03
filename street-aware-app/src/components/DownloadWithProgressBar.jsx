import React, { useState, useRef, useEffect } from "react";

export default function DownloadWithProgressBar() {
  // State holds one entry per‐host:
  // {
  //   "192.168.0.184": { done: 0, total: 1, status: "pending", path: null },
  //   "192.168.0.122": { done: 0, total: 1, status: "pending", path: null },
  //   "192.168.0.108": { done: 0, total: 1, status: "pending", path: null },
  //   "192.168.0.227": { done: 0, total: 1, status: "pending", path: null },
  // }
  const [hosts, setHosts] = useState({
    "192.168.0.184": { done: 0, total: 1, status: "pending", path: null },
    "192.168.0.122": { done: 0, total: 1, status: "pending", path: null },
    "192.168.0.108": { done: 0, total: 1, status: "pending", path: null },
    "192.168.0.227": { done: 0, total: 1, status: "pending", path: null },
  });

  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const esRef = useRef(null);

  // Kick off download when button is clicked
  const startDownload = () => {
    if (streaming) return;

    // Reset each host to pending
    const initialHosts = {
      "192.168.0.184": { done: 0, total: 1, status: "pending", path: null },
      "192.168.0.122": { done: 0, total: 1, status: "pending", path: null },
      "192.168.0.108": { done: 0, total: 1, status: "pending", path: null },
      "192.168.0.227": { done: 0, total: 1, status: "pending", path: null },
    };
    setHosts(initialHosts);
    setStreaming(true);
    setStreamError(null);

    // ◀️ Open SSE on /download-data (not /download-data/logs)
    const es = new EventSource("http://localhost:8000/download-data");

    es.addEventListener("progress", (e) => {
      try {
        const { host, done, total } = JSON.parse(e.data);
        setHosts((prev) => ({
          ...prev,
          [host]: { ...prev[host], done, total, status: "downloading" },
        }));
      } catch (err) {
        console.error("Failed to parse progress event:", err);
      }
    });

    es.addEventListener("complete", (e) => {
      try {
        const { host, status, path } = JSON.parse(e.data);
        setHosts((prev) => ({
          ...prev,
          [host]: {
            ...prev[host],
            status, // "downloaded" or "error"
            path: status === "downloaded" ? path : null,
          },
        }));
      } catch (err) {
        console.error("Failed to parse complete event:", err);
      }
    });

    es.addEventListener("end", (e) => {
      try {
        const summary = JSON.parse(e.data);
        setHosts(summary);
      } catch {
        // ignore parse failures
      }
      es.close();
      esRef.current = null;
      setStreaming(false);
    });

    es.onerror = (err) => {
      console.error("SSE stream error:", err);
      es.close();
      setStreaming(false);
      setStreamError("Connection lost or server error");
      esRef.current = null;
    };

    esRef.current = es;
  };

  const cancelDownload = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStreaming(false);
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  // Render one row (progress bar + status) for a given host
  const renderHostRow = (host, data) => {
    const { done, total, status, path } = data;
    const percent =
      total && status === "downloading" ? Math.floor((done / total) * 100) : 0;

    let statusDisplay;
    switch (status) {
      case "pending":
        statusDisplay = "Pending";
        break;
      case "downloading":
        statusDisplay = `Downloading… ${percent}%`;
        break;
      case "downloaded":
        statusDisplay = <span style={{ color: "green" }}>Done</span>;
        break;
      case "error":
        statusDisplay = <span style={{ color: "red" }}>Error</span>;
        break;
      default:
        statusDisplay = status;
    }

    return (
      <div
        key={host}
        style={{
          marginBottom: "1rem",
          border: "1px solid #ccc",
          padding: "8px",
          borderRadius: 4,
        }}
      >
        <div style={{ fontWeight: "bold" }}>{host}</div>
        <div style={{ height: "12px", background: "#eee", borderRadius: 6 }}>
          {status === "downloading" && (
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "#4caf50",
                borderRadius: 6,
              }}
            />
          )}
        </div>
        <div style={{ marginTop: 4 }}>{statusDisplay}</div>
        {status === "downloaded" && path && (
          <div style={{ fontSize: "0.85em", color: "#555", marginTop: 2 }}>
            Saved at <code>{path}</code>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", maxWidth: 800, margin: "1rem auto" }}>
      <button
        onClick={startDownload}
        disabled={streaming}
        style={{
          padding: "8px 16px",
          background: "#007bff",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: streaming ? "not-allowed" : "pointer",
        }}
      >
        {streaming ? "Downloading…" : "Download Data (Per-IP)"}
      </button>

      {streaming && (
        <button
          onClick={cancelDownload}
          style={{
            marginLeft: 8,
            padding: "8px 16px",
            background: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: 4,
          }}
        >
          Cancel All
        </button>
      )}

      {streamError && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>{streamError}</p>
      )}

      <div style={{ marginTop: "1rem" }}>
        {Object.entries(hosts).map(([host, data]) => renderHostRow(host, data))}
      </div>
    </div>
  );
}
