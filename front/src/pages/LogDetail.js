import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import {
  FiLoader,
  FiAlertTriangle,
  FiArrowLeft,
  FiUser,
  FiActivity,
  FiTarget,
  FiCpu,
  FiMessageSquare,
  FiInfo,
  FiCalendar
} from "react-icons/fi";
import "../css/LogDetail.css";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://217.71.129.139:5785',
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const methodsRequiringCsrf = ["post", "put", "delete", "patch"];
    if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
      const csrfToken = localStorage.getItem("csrfToken");
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const LogDetail = () => {
  const { id } = useParams();
  const [log, setLog] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const logId = parseInt(id, 10);
    if (!id || isNaN(logId) || logId <= 0) {
      setError("Invalid or missing record ID.");
      setLoading(false);
      return;
    }
    fetchLogDetails(logId);
  }, [id]);

  const fetchLogDetails = async (logId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/api/logs/full/${logId}`);
      if (response.data && response.data.log) {
        setLog(response.data.log);
      } else {
        setLog(null);
        setError(`Record with ID ${logId} not found.`);
      }
    } catch (err) {
      console.error("Error fetching log details:", err);
      if (err.response) {
        if (err.response.status === 404) {
          setError(`Record with ID ${logId} not found.`);
        } else if ([401, 403].includes(err.response.status)) {
          setError("Authentication error. Please log in again.");
        } else {
          setError(`Failed to get log info (Status: ${err.response.status}). Try again.`);
        }
      } else if (err.request) {
        setError("Server not responding. Check internet connection.");
      } else {
        setError("Request preparation error.");
      }
      setLog(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="log-status-container">
        <FiLoader className="icon-spin" size={48} />
        <p>LOADING RECORD DETAILS...</p>
      </div>
    );
  }

  if (error && !log) {
    return (
      <div className="log-status-container error-container-log">
        <FiAlertTriangle size={48} />
        <p className="error-text">{error}</p>
        <Link to="/logs" className="styled-button back-button-log">
          <FiArrowLeft className="button-icon" />
          BACK TO LOGS
        </Link>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="log-status-container">
        <FiInfo size={48} />
        <p>Log data not found or failed to load.</p>
        <Link to="/logs" className="styled-button back-button-log">
          <FiArrowLeft className="button-icon" />
          BACK TO LOGS
        </Link>
      </div>
    );
  }

  const getStatusClass = (status) => {
    if (!status) return 'unknown';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('success') || lowerStatus.includes('ok')) return 'success';
    if (lowerStatus.includes('fail') || lowerStatus.includes('error')) return 'error';
    if (lowerStatus.includes('warn')) return 'warning';
    if (lowerStatus.includes('info')) return 'info';
    return 'default';
  };

  return (
    <div className="log-detail-page">
      <header className="log-detail-header">
        <h1>// OPERATION LOG DETAILIZATION //</h1>
        <Link to="/home" className="styled-button back-button-header">
          <FiArrowLeft className="button-icon" />
          TO RECORDS LIST
        </Link>
      </header>

      <main className="log-detail-content">
        <div className="log-card">
          <div className="log-card-header">
            <h2>ANALYSIS OF RECORD #{log.id || id}</h2>
          </div>
          <dl className="log-attributes">
            <div className="log-attribute">
              <dt><FiCalendar className="detail-icon" />CAPTURE TIME:</dt>
              <dd>{log.time ? new Date(log.time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' }) : 'N/A'}</dd>
            </div>

            <div className="log-attribute">
              <dt><FiUser className="detail-icon" />OPERATOR:</dt>
              <dd>{log.user_name || log.user || 'NOT SPECIFIED'}</dd>
            </div>

            <div className="log-attribute">
              <dt><FiActivity className="detail-icon" />OPERATION TYPE:</dt>
              <dd>{log.action_type || log.action || 'NOT SPECIFIED'}</dd>
            </div>

            {log.weapon && (
              <div className="log-attribute">
                <dt><FiTarget className="detail-icon" />WEAPON USED:</dt>
                <dd>{log.weapon}</dd>
              </div>
            )}

            {log.special_device && (
              <div className="log-attribute">
                <dt><FiCpu className="detail-icon" />SPECIAL DEVICE:</dt>
                <dd>{log.special_device || log.special}</dd>
              </div>
            )}
            
            <div className="log-attribute log-attribute-full">
              <dt><FiMessageSquare className="detail-icon" />DETAILS / COMMENT:</dt>
              <dd className="comment-dd">{log.comment || "ABSENT"}</dd>
            </div>

            <div className="log-attribute">
              <dt><FiInfo className="detail-icon" />OPERATION STATUS:</dt>
              <dd>
                <span className={`log-status-badge status-${getStatusClass(log.status)}`}>
                  {log.status || "UNDEFINED"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </main>

      <footer className="log-detail-footer">
        <p>&copy; {new Date().getFullYear()} // OPERATIONAL LOGGING SYSTEM PROTOCOL_Z // RECORDS ARCHIVE //</p>
      </footer>
    </div>
  );
};

export default LogDetail;