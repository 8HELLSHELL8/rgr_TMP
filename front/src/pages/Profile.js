import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FiUser,
  FiShield,
  FiMail,
  FiAlertTriangle,
  FiLoader,
  FiArrowLeftCircle,
  FiTag
} from "react-icons/fi";
import "../css/ProfilePage.css";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://217.71.129.139:5785",
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const methodsRequiringCsrf = ["post", "put", "delete", "patch"];
    if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
      const csrfToken = localStorage.getItem("csrfToken"); // Assuming CSRF token is stored in localStorage for this component
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      } else {
        console.warn(
          "CSRF token not found in localStorage for state-changing request."
        );
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get("/api/users/me");
        if (response.data && response.data.user) {
          setUser(response.data.user);
        } else if (response.data && !response.data.user) {
          setUser(response.data); // Use response.data directly if 'user' field is missing
          console.warn(
            "API response for '/api/users/me' does not contain a 'user' field. Using response.data directly."
          );
        } else {
          throw new Error("API response does not contain user data.");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        if (err.response) {
          console.error("Error response data:", err.response.data);
          console.error("Error response status:", err.response.status);
          if (err.response.status === 401 || err.response.status === 403) {
            setError("Authorization error. Your session may have expired.");
            localStorage.removeItem("csrfToken"); // Clear token on auth error
            navigate("/login", {
              state: { message: "Please log in again." },
            });
          } else {
            setError(
              `Failed to get user data. Server responded: ${
                err.response.data?.message || err.response.status
              }`
            );
          }
        } else if (err.request) {
          setError(
            "Could not connect to the server. Check your internet connection."
          );
        } else {
          setError(
            "An error occurred while preparing the request: " + err.message
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  if (loading)
    return (
      <div className="profile-status-container">
        <FiLoader className="icon-spin" size={48} />
        <p>LOADING PROFILE...</p>
      </div>
    );

  if (error && !user)
    return (
      <div className="profile-status-container error-container">
        <FiAlertTriangle size={48} />
        <p className="error-message">{error}</p>
        <button onClick={() => navigate("/login")} className="styled-button">
          Try to Log In
        </button>
      </div>
    );

  if (!user)
    return (
      <div className="profile-status-container error-container">
        <FiAlertTriangle size={48} />
        <p className="error-message">
          User data not found or could not be loaded.
        </p>
      </div>
    );

  const fullName = `${user.surname || ""} ${user.name || ""} ${
    user.lastname || ""
  }`
    .replace(/\s+/g, " ")
    .trim();

  return (
    <div className="profile-page">
      <div className="profile-container">
        <header className="profile-header">
          <h1>ACCESS GRANTED: USER PROFILE</h1>
        </header>

        <main className="profile-main">
          <div className="profile-card">
            <div className="profile-card-header">
              <h2>{"// INFORMATION BLOCK //"}</h2>
            </div>
            <dl className="profile-details">
              <div className="profile-detail-item">
                <dt>
                  <FiUser className="detail-icon" />
                  OPERATOR:
                </dt>
                <dd>{fullName || "N/A"}</dd>
              </div>

              <div className="profile-detail-item">
                <dt>
                  <FiShield className="detail-icon" />
                  CLASSIFICATION:
                </dt>
                <dd>{user.role?.name || "NOT DEFINED"}</dd>
              </div>

              {user.username && (
                <div className="profile-detail-item">
                  <dt>
                    <FiTag className="detail-icon" />
                    CALLSIGN:
                  </dt>
                  <dd>{user.username}</dd>
                </div>
              )}

              {user.email && (
                <div className="profile-detail-item">
                  <dt>
                    <FiMail className="detail-icon" />
                    COMMUNICATION CHANNEL (EMAIL):
                  </dt>
                  <dd>{user.email}</dd>
                </div>
              )}
            </dl>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="styled-button back-button"
          >
            <FiArrowLeftCircle className="button-icon" />
            RETURN
          </button>
        </main>
      </div>
    </div>
  );
};

export default Profile;