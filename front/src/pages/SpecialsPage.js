import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FiCpu,
  FiArrowLeftCircle,
  FiLoader,
  FiAlertTriangle,
  FiRefreshCw,
  FiFilter,
  FiTag,
  FiActivity,
  FiList,
  FiSlash,
  FiArchive,
  FiFileText,
  FiEye,
} from "react-icons/fi";
import "../css/SpecialsPage.css";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://217.71.129.139:5785",
  withCredentials: true,
});

const SpecialsPage = () => {
  const [specials, setSpecials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortCriteria, setSortCriteria] = useState('name');
  const navigate = useNavigate();

  // Initial Auth Check
  useEffect(() => {
    apiClient.get("/api/users/me")
      .then(() => { /* User is authenticated */ })
      .catch((err) => {
        console.warn("Auth check failed on SpecialsPage mount:", err.message); // Dev-facing
      });
  }, []);

  const fetchSpecials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/specials");
      let fetchedSpecials = response.data.specials || response.data || [];

      fetchedSpecials.sort((a, b) => {
        switch (sortCriteria) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '');
          case 'type':
            return (a.typeName || '').localeCompare(b.typeName || '');
          case 'status':
            return (a.statusName || '').localeCompare(b.statusName || '');
          default:
            return 0;
        }
      });

      setSpecials(fetchedSpecials);
    } catch (err) {
      console.error("Ошибка при загрузке спецустройств:", err); // Dev-facing
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          setError("Session expired or access denied. Please log in again.");
          navigate("/login", { state: { message: "Please log in again." } });
        } else {
          setError(`Failed to load special equipment list. Server responded: ${err.response.data?.message || err.response.status}`);
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
    fetchSpecials();
  }, [fetchSpecials]);

  const uniqueTypes = [...new Set(specials.map(s => s.typeName).filter(Boolean))];
  const uniqueStatuses = [...new Set(specials.map(s => s.statusName).filter(Boolean))];

  const filteredSpecials = specials.filter(special => {
    return (
      (filterType === '' || special.typeName === filterType) &&
      (filterStatus === '' || special.statusName === filterStatus)
    );
  });

  if (loading) {
    return (
      <div className="export-logs-page specials-page">
        <div className="page-container">
          <div className="status-container">
            <FiLoader className="icon-spin" size={48} />
            <p>LOADING SPECIAL EQUIPMENT LIST...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && specials.length === 0) {
    return (
      <div className="export-logs-page specials-page">
        <div className="page-container">
          <div className="status-container error-display">
            <FiAlertTriangle size={48} />
            <p className="error-message">{error}</p>
            <div className="status-actions">
               { (error.includes("Session expired") || error.includes("access denied")) && // Adjusted condition for English error message
                <button onClick={() => navigate("/login")} className="styled-button">
                    Go to Login Page
                </button>
               }
              <button onClick={fetchSpecials} className="styled-button button-secondary">
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
    <div className="export-logs-page specials-page">
      <div className="page-container">
        <header className="page-header">
          <h1>
            <FiCpu className="header-icon" />
            {"// SPECIAL EQUIPMENT //"}
          </h1>
          <button className="styled-button back-button" onClick={() => navigate('/home')}>
            <FiArrowLeftCircle className="button-icon" />
            {"Back"}
          </button>
        </header>

        <main className="export-main">
          <div className="card-style filters-controls-card">
            <h2 className="section-title">
              <FiFilter className="title-icon" />
              {"// CONTROL AND FILTERING PANEL //"}
            </h2>
            <div className="filter-grid">
              <div className="filter-group">
                <label htmlFor="filter-type">
                  <FiTag className="label-icon" /> {"Device Category:"}
                </label>
                <select id="filter-type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All Categories</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-status">
                  <FiActivity className="label-icon" /> Current Status:
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
                  <FiList className="label-icon" /> Sort Algorithm:
                </label>
                <select id="sort-criteria" value={sortCriteria} onChange={(e) => setSortCriteria(e.target.value)}>
                  <option value="name">By Name (A-Z)</option>
                  <option value="type">By Category</option>
                  <option value="status">By Status</option>
                </select>
              </div>
            </div>
            <div className="controls-actions">
                <button className="styled-button" onClick={fetchSpecials}>
                    <FiRefreshCw className="button-icon" />
                    Refresh Data from Server
                </button>
            </div>
          </div>

          {error && <p className="error-message inline-error"><FiAlertTriangle/> {error}</p>}

          {filteredSpecials.length > 0 ? (
            <ul className="item-list special-list">
              {filteredSpecials.map((special) => (
                <li key={special.id} className="item-card-item special-card-item card-style">
                  <Link to={`/specials/${special.id}`} className="item-link-wrapper">
                    <div className="item-card-header">
                        <h3>
                            <FiArchive className="title-icon"/>
                            {special.name || "N/A"}
                        </h3>
                    </div>
                    <div className="item-card-body">
                        <p><FiTag className="detail-icon" /> <strong>Category:</strong> {special.typeName || "Not specified"}</p>
                        <p><FiActivity className="detail-icon" /> <strong>Status:</strong> {special.statusName || "Undefined"}</p>
                        <p className="description">
                            <FiFileText className="detail-icon" />
                            <strong>Description:</strong> {special.description || "Brief description is missing."}
                        </p>
                    </div>
                    <div className="item-card-footer">
                        <span className="styled-button button-sm button-secondary">
                            <FiEye className="button-icon"/> View Details
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
                    <p className="no-data-message">NO SPECIAL EQUIPMENT FOUND MATCHING THE CRITERIA.</p>
                    { (filterType || filterStatus) &&
                        <button
                            className="styled-button button-secondary"
                            onClick={() => { setFilterType(''); setFilterStatus(''); }}
                        >
                            Reset Active Filters
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

export default SpecialsPage;