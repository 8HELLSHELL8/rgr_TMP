import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  FiTarget,
  FiArrowLeftCircle,
  FiInfo,
  FiFileText,
  FiTag,
  FiActivity,
  FiCalendar,
  FiLoader,
  FiAlertTriangle,
  FiRefreshCw
} from "react-icons/fi";
import "../css/WeaponDetailsPage.css";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://217.71.129.139:5785",
  withCredentials: true,
});

const WeaponDetailsPage = () => {
  const { id } = useParams();
  const [weapon, setWeapon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchWeapon = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/api/weapons/${id}`);
      if (response.data && (response.data.weapon || response.data)) {
        setWeapon(response.data.weapon || response.data);
      } else {
        throw new Error("Weapon data not found in API response.");
      }
    } catch (err) {
      console.error("Ошибка при загрузке данных об оружии:", err); // Dev-facing
      if (err.response) {
         if (err.response.status === 401 || err.response.status === 403) {
          setError("Authorization error or session expired.");
          navigate("/login", { state: { message: "Please log in again." } });
        } else if (err.response.status === 404) {
          setError("Weapon unit with this ID not found.");
        } else {
          setError(`Failed to load data. Server responded: ${err.response.data?.message || err.response.status}`);
        }
      } else if (err.request) {
        setError("Could not connect to the server. Check your internet connection.");
      } else {
        setError("An error occurred while preparing the request: " + err.message);
      }
      setWeapon(null);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchWeapon();
  }, [fetchWeapon]);

  if (loading) {
    return (
      <div className="export-logs-page weapon-details-page">
        <div className="page-container">
          <div className="status-container">
            <FiLoader className="icon-spin" size={48} />
            <p>{"LOADING WEAPON UNIT DATA..."}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="export-logs-page weapon-details-page">
        <div className="page-container">
          <div className="status-container error-display">
            <FiAlertTriangle size={48} />
            <p className="error-message">{error}</p>
            <div className="status-actions">
              <Link to="/weapons" className="styled-button button-secondary">
                <FiArrowLeftCircle className="button-icon" />
                {"To Weapons List"}
              </Link>
              <button onClick={fetchWeapon} className="styled-button">
                <FiRefreshCw className="button-icon" />
                {"Try Again"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!weapon) {
    // Fallback: weapon not found
    return (
      <div className="export-logs-page weapon-details-page">
        <div className="page-container">
          <div className="status-container error-display">
            <FiAlertTriangle size={48} />
            <p className="error-message">{"Weapon data not found or failed to load."}</p>
             <Link to="/weapons" className="styled-button">
                <FiArrowLeftCircle className="button-icon" />
                {"To Weapons List"}
              </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="export-logs-page weapon-details-page">
      <div className="page-container">
        <header className="page-header">
          <h1>
            <FiTarget className="header-icon" />
            {"// ASSET:"} {weapon.name || "N/A"} {"//"}
          </h1>
          <Link to="/weapons" className="styled-button back-button">
            <FiArrowLeftCircle className="button-icon" />
            {"Back to List"}
          </Link>
        </header>

        <main className="export-main">
          <div className="card-style weapon-info-card">
            <h2 className="section-title">
              <FiInfo className="title-icon" />
              {"// TECHNICAL OVERVIEW //"}
            </h2>
            <dl className="details-list">
              <div className="detail-item">
                <dt>
                  <FiTag className="detail-icon" />
                  {"Classification (Type):"}
                </dt>
                <dd>{weapon.typeName || "Not specified"}</dd>
              </div>

              <div className="detail-item">
                <dt>
                  <FiActivity className="detail-icon" />
                  {"Operational Status:"}
                </dt>
                <dd>{weapon.statusName || "Not specified"}</dd>
              </div>

              <div className="detail-item">
                <dt>
                  <FiCalendar className="detail-icon" />
                  {"Last Maintenance Date:"}
                </dt>
                <dd>
                  {weapon.lastMaintenance
                    ? new Date(weapon.lastMaintenance).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : "Not performed"}
                </dd>
              </div>

              <div className="detail-item description-item">
                <dt>
                  <FiFileText className="detail-icon" />
                  {"Tactical Description:"}
                </dt>
                <dd className="description-text">
                  {weapon.description || "Detailed description is missing."}
                </dd>
              </div>
            </dl>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WeaponDetailsPage;