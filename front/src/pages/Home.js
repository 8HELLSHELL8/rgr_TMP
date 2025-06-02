import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import {
  FiUser,
  FiRefreshCw,
  FiTarget,
  FiCpu,
  FiSearch,
  FiEye,
  FiAlertCircle,
  FiCheckCircle,
  FiX,
  FiGrid,
  FiList,
  FiFilter,
  FiDownloadCloud,
  FiEdit3,
  FiPower,
  FiHardDrive,
  FiPocket,
  FiLoader
} from "react-icons/fi";
import "../css/Home.css";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://217.71.129.139:5785",
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const getCookie = (name) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    };
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method.toUpperCase())) {
      const csrfToken = getCookie('csrf-token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      } else {
        console.warn('CSRF token cookie not found for state-changing request.');
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const Home = ({ finalizeLogoutProcess, apiClient }) => {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [sortCriteria, setSortCriteria] = useState("time-desc");
  const [filterAction, setFilterAction] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [userDisplayName, setUserDisplayName] = useState("Operator");
  const navigate = useNavigate();

  const currentApiClient = apiClient;

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const userData = JSON.parse(userString);
        setUserDisplayName(userData.username || `${userData.name} ${userData.surname}`.trim() || "Operator");
      } catch (e) {
        console.error("Error parsing user data from localStorage:", e);
      }
    }
  }, []);

  const showMessage = (text, type, duration = 5000) => {
    setMessage({ text, type });
    const timer = setTimeout(() => {
      setMessage({ text: "", type: "" });
    }, duration);
    return () => clearTimeout(timer);
  };

  const fetchLogs = useCallback(async () => {
    if (!currentApiClient) {
      setError("Configuration error: API client not available.");
      setLoadingLogs(false);
      setLogs([]);
      return;
    }
    setLoadingLogs(true);
    setError(null);
    try {
      const response = await currentApiClient.get("/api/logs/summary");
      let fetchedLogs = response.data?.logs || [];
      fetchedLogs.sort((a, b) => {
        switch (sortCriteria) {
          case "time-asc": return new Date(a.time) - new Date(b.time);
          case "time-desc": return new Date(b.time) - new Date(a.time);
          case "action": return (a.action || "").localeCompare(b.action || "");
          case "item": return (a.item || "").localeCompare(b.item || "");
          default: return 0;
        }
      });
      setLogs(fetchedLogs);
    } catch (err) {
      console.error("Error loading logs:", err);
      if (err.response && err.response.status === 401) {
        showMessage("Session expired or no authorization. Redirecting to login...", "error", 3000);
        if (finalizeLogoutProcess) {
          setTimeout(() => finalizeLogoutProcess(), 3000);
        } else {
          setTimeout(() => navigate("/"), 3000);
        }
      } else {
        setError("Failed to load operational briefings. Try refreshing.");
      }
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [sortCriteria, navigate, currentApiClient, finalizeLogoutProcess]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const uniqueActions = React.useMemo(() => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(), [logs]);
  const uniqueItems = React.useMemo(() => [...new Set(logs.map((log) => log.item).filter(Boolean))].sort(), [logs]);
  const uniqueStatuses = React.useMemo(() => [...new Set(logs.map((log) => log.status).filter(Boolean))].sort(), [logs]);

  const filteredLogs = React.useMemo(() => logs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const timeString = log.time ? new Date(log.time).toLocaleString('en-US').toLowerCase() : "";
    return (
      (!filterAction || log.action === filterAction) &&
      (!filterItem || log.item === filterItem) &&
      (!filterStatus || log.status === filterStatus) &&
      ( (log.user || "").toLowerCase().includes(searchLower) ||
        (log.action || "").toLowerCase().includes(searchLower) ||
        (log.item || "").toLowerCase().includes(searchLower) ||
        (log.status || "").toLowerCase().includes(searchLower) ||
        timeString.includes(searchLower)
      )
    );
  }), [logs, searchQuery, filterAction, filterItem, filterStatus]);

  const handleLogout = async () => {
    if (!currentApiClient) {
      showMessage("Configuration error for logout.", "error");
      if (!finalizeLogoutProcess) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        window.location.href = "/";
      } else {
        finalizeLogoutProcess();
      }
      return;
    }
    showMessage("Logging out...", "info", 10000);
    try {
      await currentApiClient.post("/api/logout", {});
      showMessage("Logout successfully executed on server.", "success", 2000);
      setTimeout(() => {
        if (finalizeLogoutProcess) {
          finalizeLogoutProcess();
        } else {
          console.error("finalizeLogoutProcess prop not available. Performing manual cleanup.");
          localStorage.removeItem("authToken");
          localStorage.removeItem("csrfToken");
          localStorage.removeItem("user");
          window.location.href = "/";
        }
      }, 1500);
    } catch (err) {
      console.error("Logout error (API call or subsequent process):", err);
      showMessage("Logout error. Performing forced cleanup...", "error", 3000);
      setTimeout(() => {
        if (finalizeLogoutProcess) {
          finalizeLogoutProcess();
        } else {
          console.error("finalizeLogoutProcess prop not available after error. Performing manual cleanup.");
          localStorage.removeItem("authToken");
          localStorage.removeItem("csrfToken");
          localStorage.removeItem("user");
          window.location.reload();
        }
      }, 2500);
    }
  };

  const MessageBar = () => {
    if (!message.text) return null;
    const Icon = message.type === "success" ? FiCheckCircle : FiAlertCircle;
    return (
      <div className={`message-bar message-${message.type}`}>
        <Icon className="message-icon" />
        <span>{message.text}</span>
        <button onClick={() => setMessage({ text: "", type: "" })} className="message-close-button">
          <FiX />
        </button>
      </div>
    );
  };

  return (
    <div className="home-page">
      <MessageBar />
      <header className="home-header">
        <div className="header-main-row">
          <div className="header-app-title-block">
            <FiGrid className="app-logo-icon"/>
            <span className="header-app-title">OPERATIONAL ACCOUNTING SYSTEM</span>
          </div>
          <div className="header-user-controls">
            <button className="styled-button icon-button" title={userDisplayName} onClick={() => navigate("/profile")}>
              <FiUser /> <span>{userDisplayName}</span>
            </button>
            <button className="styled-button icon-button" title="Logout" onClick={handleLogout}>
              <FiPower /> <span>Logout</span>
            </button>
          </div>
        </div>
        <nav className="header-nav-actions">
          <button className="styled-button nav-action-button" onClick={() => navigate("/make-action")}>
            <FiEdit3 /> New Entry
          </button>
          <button className="styled-button nav-action-button" onClick={() => navigate("/logs/download")}>
            <FiDownloadCloud /> Export Log
          </button>
        </nav>
      </header>
      <main className="home-main-content">
        <div className="page-container">
          <h1 className="main-page-title"><FiGrid /> CONTROL PANEL</h1>
          <section className="quick-access-section card-style">
            <h2 className="section-title"><FiPocket /> INVENTORY AND RESOURCES</h2>
            <div className="buttons-grid">
              <button className="styled-button quick-access-button" onClick={() => navigate("/weapons")}>
                <FiHardDrive /> WEAPON ACCOUNTING
              </button>
              <button className="styled-button quick-access-button" onClick={() => navigate("/specials")}>
                <FiCpu /> SPECIAL MEANS ACCOUNTING
              </button>
            </div>
          </section>
          <section className="logs-section card-style">
            <div className="logs-header">
              <h2 className="section-title"><FiList /> OPERATIONAL BRIEFING</h2>
              <button className="styled-button icon-button refresh-logs-button" onClick={fetchLogs} disabled={loadingLogs || !currentApiClient}>
                {loadingLogs ? <FiLoader className="icon-spin" /> : <FiRefreshCw />}
                {loadingLogs ? "LOADING..." : (!currentApiClient ? "API NOT AVAILABLE" : "REFRESH")}
              </button>
            </div>
            <div className="search-filter-bar">
              <div className="search-container">
                <FiSearch className="search-input-icon" />
                <input
                  type="text"
                  placeholder="Search briefings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
            <div className="filters-sort-container">
              <h3 className="filters-title"><FiFilter/> Filters & Sorting</h3>
              <div className="filter-controls-grid">
                <div className="filter-group">
                  <label htmlFor="filter-action">ACTION:</label>
                  <select id="filter-action" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
                    <option value="">ALL</option>
                    {uniqueActions.map((action) => <option key={action} value={action}>{action.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-item">OBJECT:</label>
                  <select id="filter-item" value={filterItem} onChange={(e) => setFilterItem(e.target.value)}>
                    <option value="">ALL</option>
                    {uniqueItems.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-status">STATUS:</label>
                  <select id="filter-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">ALL</option>
                    {uniqueStatuses.map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="sort-criteria">SORTING:</label>
                  <select id="sort-criteria" value={sortCriteria} onChange={(e) => setSortCriteria(e.target.value)}>
                    <option value="time-desc">BY TIME (NEWEST)</option>
                    <option value="time-asc">BY TIME (OLDEST)</option>
                    <option value="action">BY ACTION</option>
                    <option value="item">BY OBJECT</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="logs-display-area">
              {error && <p className="status-message error-message"><FiAlertCircle /> {error}</p>}
              {(!currentApiClient && !error) && <p className="status-message error-message"><FiAlertCircle /> Configuration error: API client not provided.</p>}
              {loadingLogs && !error && currentApiClient && <div className="status-container inline-loader"><FiLoader className="icon-spin" size={32}/><p>LOADING BRIEFINGS...</p></div>}
              {!loadingLogs && !error && currentApiClient && filteredLogs.length > 0 && (
                <ul className="logs-list">
                  {filteredLogs.map((log) => (
                    <li key={log.id} className="log-item">
                      <Link to={`/logs/full/${log.id}`} className="log-link-content">
                        <div className="log-meta">
                          <span className="log-time">{log.time ? new Date(log.time).toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                          <span className="log-status-badge" data-status={log.status?.toLowerCase()}>{log.status || "N/A"}</span>
                        </div>
                        <div className="log-details">
                          <span className="log-user"><FiUser className="log-detail-icon"/> {log.user || "System"}</span>
                          <span className="log-action"><FiTarget className="log-detail-icon"/> {log.action || "Not specified"}</span>
                          {log.item && <span className="log-item-name"><FiCpu className="log-detail-icon"/> {log.item}</span>}
                        </div>
                        <FiEye className="log-view-indicator" title="Details"/>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {!loadingLogs && !error && currentApiClient && logs.length > 0 && filteredLogs.length === 0 && (
                <p className="status-message no-results-message">No briefings found for the selected criteria.</p>
              )}
              {!loadingLogs && !error && currentApiClient && logs.length === 0 && (
                <p className="status-message no-results-message">Operational briefings are missing.</p>
              )}
            </div>
          </section>
        </div>
      </main>
      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} SECTOR ALPHA-7. OPERATIONAL CONTROL. ACCESS RESTRICTED.</p>
      </footer>
    </div>
  );
};

export default Home;