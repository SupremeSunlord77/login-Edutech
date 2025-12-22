"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  // 🔐 AUTH CHECK
  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        if (res.data.data.role !== "SUPERADMIN") {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"));
  }, []);

  return (
    <>
      {/* ===== STYLES (FROM YOUR HTML) ===== */}
      <style>{`
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f9fafb;
        }

        .header {
          background-color: #000;
          padding: 16px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          color: white;
          font-weight: 600;
        }

        .user-badge {
          background: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-weight: 500;
        }

        .container {
          max-width: 1400px;
          margin: auto;
          padding: 40px 32px;
        }

        .hero {
          background: linear-gradient(135deg, #0f1419, #1a202c);
          color: white;
          padding: 40px;
          border-radius: 12px;
          margin-bottom: 40px;
        }

        .controls-bar {
          display: flex;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .btn-primary {
          background: #0f1419;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 6px;
          cursor: pointer;
        }

        .schools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
        }

        .school-card {
          background: white;
          padding: 24px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-content {
          background: white;
          padding: 32px;
          border-radius: 8px;
          width: 400px;
        }
      `}</style>

      {/* ===== HEADER ===== */}
      <header className="header">
        <div className="logo">🏫 EduSystem Admin</div>
        <div className="user-badge">SA</div>
      </header>

      {/* ===== MAIN ===== */}
      <div className="container">
        <div className="hero">
          <h1>School Management</h1>
          <p>Centralized control panel for all institutions.</p>
        </div>

        <div className="controls-bar">
          <h3>Schools</h3>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Create School
          </button>
        </div>

        <div className="schools-grid">
          <div className="school-card">
            <h3>Demo School</h3>
            <p>Status: Active</p>
          </div>
        </div>
      </div>

      {/* ===== MODAL (UI ONLY) ===== */}
      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create School</h2>
            <p>Form wiring will be done later</p>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
