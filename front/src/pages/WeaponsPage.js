import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FiArrowLeftCircle,
  FiLoader,
  FiAlertTriangle,
  FiRefreshCw,
  FiFilter,
  FiTag,
  FiActivity,
  FiList,
  FiSlash,
  FiTarget,
  FiCalendar,
  FiFileText,
  FiEye,
} from "react-icons/fi";
import "../css/WeaponsPage.css";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://217.71.129.139:5785",
  withCredentials: true,
});


const WeaponsPage = () => {
  const [weapons, setWeapons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortCriteria, setSortCriteria] = useState('name');
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.get("/api/users/me")
      .then(() => { /* User is authenticated */ })
      .catch((err) => {
        console.error("Ошибка авторизации при проверке /api/users/me:", err); // Developer-facing log
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        }
      });
  }, []);

  const fetchWeapons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/weapons");
      let fetchedWeapons = response.data.weapons || response.data || [];

      fetchedWeapons.sort((a, b) => {
        switch (sortCriteria) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '');
          case 'type':
            return (a.typeName || '').localeCompare(b.typeName || '');
          case 'status':
            return (a.statusName || '').localeCompare(b.statusName || '');
          case 'lastMaintenance':
            const dateA = a.lastMaintenance ? new Date(a.lastMaintenance) : new Date(0);
            const dateB = b.lastMaintenance ? new Date(b.lastMaintenance) : new Date(0);
            return dateB - dateA;
          default:
            return 0;
        }
      });

      setWeapons(fetchedWeapons);
    } catch (err) {
      console.error("Ошибка при загрузке оружия:", err); // Developer-facing log
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          setError("Session expired or access denied. Please log in again.");
          localStorage.removeItem("csrfToken");
          navigate("/login", { state: { message: "Please log in again." } });
        } else {
          setError(`Failed to load weapons list. Server responded: ${err.response.data?.message || err.response.status}`);
        }
      } else if (err.request) {
        setError("Could not connect to the server. Check your internet connection.");
      } else {
        setError("An error occurred while preparing the request: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [sortCriteria, navigate]);

  useEffect(() => {
    fetchWeapons();
  }, [fetchWeapons]);

  const uniqueTypes = [...new Set(weapons.map(w => w.typeName).filter(Boolean))];
  const uniqueStatuses = [...new Set(weapons.map(w => w.statusName).filter(Boolean))];

  const filteredWeapons = weapons.filter(weapon => {
    return (
      (filterType === '' || weapon.typeName === filterType) &&
      (filterStatus === '' || weapon.statusName === filterStatus)
    );
  });

  if (loading) {
    return (
      <div className="export-logs-page weapons-page">
        <div className="page-container">
          <div className="status-container">
            <FiLoader className="icon-spin" size={48} />
            <p>LOADING WEAPONS LIST...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && weapons.length === 0) {
    return (
      <div className="export-logs-page weapons-page">
        <div className="page-container">
          <div className="status-container error-display">
            <FiAlertTriangle size={48} />
            <p className="error-message">{error}</p>
            <div className="status-actions">
              <button onClick={() => navigate("/login")} className="styled-button">
                Go to Login Page
              </button>
              <button onClick={fetchWeapons} className="styled-button button-secondary">
                <FiRefreshCw className="button-icon" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="export-logs-page weapons-page">
      <div className="page-container">
        <header className="page-header">
          <h1>{"// ARMORY: WEAPONS LIST //"}</h1>
          <button className="styled-button back-button" onClick={() => navigate(-1)}>
            <FiArrowLeftCircle className="button-icon" />
            Back
          </button>
        </header>

        <main className="export-main">
          <div className="card-style filters-controls-card">
            <h2 className="section-title">
              <FiFilter className="title-icon" />
              {"// CONTROL AND FILTERING BLOCK //"}
            </h2>
            <div className="filter-grid">
              <div className="filter-group">
                <label htmlFor="filter-type">
                  <FiTag className="label-icon" /> WEAPON TYPE:
                </label>
                <select id="filter-type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-status">
                  <FiActivity className="label-icon" /> COMBAT STATUS:
                </label>
                <select id="filter-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="sort-criteria">
                  <FiList className="label-icon" /> SORT CRITERIA:
                </label>
                <select id="sort-criteria" value={sortCriteria} onChange={(e) => setSortCriteria(e.target.value)}>
                  <option value="name">By Name (A-Z)</option>
                  <option value="type">By Type</option>
                  <option value="status">By Status</option>
                  <option value="lastMaintenance">By Maintenance Date (Newest First)</option>
                </select>
              </div>
            </div>
            <div className="controls-actions">
                <button className="styled-button" onClick={fetchWeapons}>
                    <FiRefreshCw className="button-icon" />
                    Refresh Data from Server
                </button>
            </div>
          </div>

          {error && <p className="error-message inline-error"><FiAlertTriangle/> {error}</p>}


          {filteredWeapons.length > 0 ? (
            <ul className="weapon-list">
              {filteredWeapons.map((weapon) => (
                <li key={weapon.id} className="weapon-card-item card-style">
                  <Link to={`/weapons/${weapon.id}`} className="weapon-link-wrapper">
                    <div className="weapon-card-header">
                        <h3>
                            <FiTarget className="title-icon"/>{" "}
                            {weapon.name || "N/A"}
                        </h3>
                    </div>
                    <div className="weapon-card-body">
                        <p><FiTag className="detail-icon" /> <strong>Type:</strong> {weapon.typeName || "Not specified"}</p>
                        <p><FiActivity className="detail-icon" /> <strong>Status:</strong> {weapon.statusName || "Undefined"}</p>
                        <p><FiCalendar className="detail-icon" /> <strong>Maintained:</strong> {weapon.lastMaintenance ? new Date(weapon.lastMaintenance).toLocaleDateString() : "N/A"}</p>
                        <p className="description">
                            <FiFileText className="detail-icon" />
                            <strong>Description:</strong> {weapon.description || "No description"}
                        </p>
                    </div>
                    <div className="weapon-card-footer">
                        <span className="styled-button button-sm button-secondary">
                            <FiEye className="button-icon"/> Details
                        </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
             !loading && !error && (
                <div className="status-container no-data-card card-style">
                    <FiSlash size={48} />
                    <p className="no-data-message">NO WEAPON UNITS FOUND MATCHING THE CRITERIA.</p>
                    { (filterType || filterStatus) &&
                        <button
                            className="styled-button button-secondary"
                            onClick={() => { setFilterType(''); setFilterStatus(''); }}
                        >
                            Reset Filters
                        </button>
                    }
                </div>
             )
          )}
        </main>
      </div>
    </div>
  );
};

export default WeaponsPage;