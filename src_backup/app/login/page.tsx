"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("accessToken", res.data.accessToken);

      if (res.data.user.role === "SUPERADMIN") {
        router.push("/superadmin/dashboard");
      } else {
        alert("Access denied");
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
          margin: 0;
          padding: 0;
          background-color: #f8f9fa;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
        }

        .navbar {
          width: 100%;
          padding: 20px 50px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
        }

        .logo {
          font-weight: bold;
          font-size: 1.2rem;
          color: #1a1d23;
        }

        .login-container {
          margin-top: 80px;
          width: 450px;
          position: relative;
        }

        .welcome-card {
          background-color: #12141a;
          color: white;
          padding: 40px 40px 100px;
          border-radius: 12px;
        }

        .welcome-card h1 {
          margin: 0;
          font-size: 2rem;
        }

        .welcome-card p {
          color: #9ca3af;
          margin-top: 10px;
        }

        .form-card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          margin: -70px 25px 0;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        }

        .input-group {
          margin-bottom: 20px;
        }

        input {
          width: 100%;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .login-btn {
          width: 100%;
          background-color: #12141a;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        }

        .form-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 25px;
          font-size: 0.85rem;
          color: #6b7280;
        }

        .signup-text {
          text-align: center;
          margin-top: 30px;
          color: #6b7280;
        }
      `}</style>

      <header className="navbar">
        <h1 className="logo">SmartGrade EduSystem</h1>
      </header>

      <div className="login-container">
        <div className="welcome-card">
          <h1>Welcome</h1>
          <p>Login to your account</p>
        </div>

        <div className="form-card">
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="login-btn">
              Login
            </button>

            <div className="form-footer">
              <label>
                <input type="checkbox" /> Remember me
              </label>
              <span>|</span>
              <span>Forgot Password?</span>
            </div>
          </form>
        </div>

        <div className="signup-text">
          Don’t have your account? <strong>Contact Admin</strong>
        </div>
      </div>
    </>
  );
}
