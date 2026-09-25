import { useState } from "react";
import Dashboard from "./Dashboard";
import "./App.css";
import collegeLogo from "./assets/kr logo.jpg";

function App() {
  const [page, setPage] = useState("register");

  const [formData, setFormData] = useState({
    fullName: "",
    studentId: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // REGISTER
  const handleSubmit = async (e) => {
    e.preventDefault();

    const {
      fullName,
      studentId,
      email,
      password,
      confirmPassword,
    } = formData;

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:5001/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName,
            studentId,
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Registration failed");
        return;
      }

      alert("Registration successful!");

      setLoginData({
        email: email,
        password: "",
      });

      setPage("login");
    } catch (error) {
      console.error("Registration error:", error);
      alert("Backend se connect nahi ho pa raha.");
    }
  };

  // LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        "http://localhost:5001/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(loginData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Login failed");
        return;
      }

      alert("Login successful!");
      setPage("dashboard");
    } catch (error) {
      console.error("Login error:", error);
      alert("Backend se connect nahi ho pa raha.");
    }
  };

  if (page === "dashboard") {
    return <Dashboard />;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">

        <img
          src={collegeLogo}
          alt="College Logo"
          className="college-logo"
        />

        <h1>Library Management System</h1>

        {page === "register" ? (
          <>
            <h2>Create Account</h2>

            <form onSubmit={handleSubmit}>
              <input
                type="text"
                name="fullName"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={handleChange}
                required
              />

              <input
                type="text"
                name="studentId"
                placeholder="Student ID"
                value={formData.studentId}
                onChange={handleChange}
                required
              />

              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />

              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />

              <button type="submit">
                Register
              </button>
            </form>

            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setPage("login")}
              >
                Login
              </button>
            </p>
          </>
        ) : (
          <>
            <h2>Login</h2>

            <form onSubmit={handleLogin}>
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={loginData.email}
                onChange={handleLoginChange}
                required
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                value={loginData.password}
                onChange={handleLoginChange}
                required
              />

              <button type="submit">
                Login
              </button>
            </form>

            <p>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setPage("register")}
              >
                Register
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default App;