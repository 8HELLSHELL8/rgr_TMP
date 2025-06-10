import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FiX, FiArrowLeftCircle, FiLoader, FiAlertTriangle } from "react-icons/fi";
import { FaDownload, FaFilter } from "react-icons/fa";
import "../css/SaveLog.css";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://217.71.129.139:5785",
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method.toUpperCase());
    const isExportPath = config.url && config.url.includes('/api/logs/export/');

    if (isStateChangingMethod || (config.method.toUpperCase() === 'GET' && isExportPath)) {
      const csrfToken = getCookie('csrf-token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      } else {
        console.warn('CSRF token cookie not found. Request to a protected route might fail.');
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const SaveLog = () => {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const navigate = useNavigate();

  const uniqueActions = React.useMemo(() => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(), [logs]);
  const uniqueItems = React.useMemo(() => [...new Set(logs.map((log) => log.item).filter(Boolean))].sort(), [logs]);
  const uniqueStatuses = React.useMemo(() => [...new Set(logs.map((log) => log.status).filter(Boolean))].sort(), [logs]);

  const fetchAllLogs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/logs/summary");
      setLogs(response.data?.logs || []);
    } catch (err) {
      console.error("Error loading logs:", err);
      if (err.response && err.response.status === 401) {
        setError("Authorization error. Please log in again.");
        navigate('/login');
      } else {
        setError("Failed to load log data. Try refreshing the page.");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchAllLogs();
  }, [fetchAllLogs]);


  const getFilteredLogsForPreview = React.useCallback(() => {
    return logs.filter((log) => {
      let dateLog;
      try {
        dateLog = new Date(log.time);
        if (isNaN(dateLog.getTime())) {
            return false;
        }
      } catch (e) {
        return false;
      }

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && isNaN(start.getTime())) return false;
      if (end && isNaN(end.getTime())) return false;

      let inTimeRange = true;
      if (start && end) {
        inTimeRange = dateLog >= start && dateLog <= end;
      } else if (start) {
        inTimeRange = dateLog >= start;
      } else if (end) {
        inTimeRange = dateLog <= end;
      }

      return (
        inTimeRange &&
        (!filterAction || log.action === filterAction) &&
        (!filterItem || log.item === filterItem) &&
        (!filterStatus || log.status === filterStatus)
      );
    });
  }, [logs, startDate, endDate, filterAction, filterItem, filterStatus]);


  const handleExport = async (exportType) => {
    if (getFilteredLogsForPreview().length === 0 && (startDate || endDate || filterAction || filterItem || filterStatus)) {
      alert("Preview is empty according to current filters. Export may not contain data if server filters match. Continue export?");
    }

    const endpoint = `/api/logs/export/${exportType}`;
    const filename = `security_logs_${new Date().toISOString().split('T')[0]}.${exportType}`;
    let blobType = "";

    switch (exportType) {
      case "pdf": blobType = "application/pdf"; break;
      case "csv": blobType = "text/csv;charset=utf-8;"; break;
      case "xlsx": blobType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; break;
      default: alert("Unknown export format."); return;
    }

    try {
      const response = await apiClient.get(endpoint, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          action: filterAction || undefined,
          item: filterItem || undefined,
          status: filterStatus || undefined,
        },
        responseType: "blob",
      });

      if (response.status === 204) {
          alert("No data to export on the server for the specified filters.");
          return;
      }
      if (response.data.type === 'application/json') {
        const errorJson = JSON.parse(await response.data.text());
        alert(`Export error: ${errorJson.message || 'Unknown server error.'}`);
        return;
      }

      const blob = new Blob([response.data], { type: blobType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error exporting ${exportType.toUpperCase()}:`, error);
      let message = `Failed to download logs in ${exportType.toUpperCase()} format.`;
      if (error.response) {
          if (error.response.status === 401) message = "Authorization error. Please log in again.";
          else if (error.response.status === 403) message = "CSRF token error or insufficient permissions.";
          else if (error.response.status === 404) message = "Data for export with specified filters not found on server.";
          else if (error.response.data) {
            try {
                const errorText = await error.response.data.text();
                const errorJson = JSON.parse(errorText);
                if (errorJson && errorJson.message) message = errorJson.message;
            } catch (parseError) {
                message = `Server responded with error ${error.response.status}.`;
            }
          }
      }
      alert(message);
    }
  };


  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setFilterAction("");
    setFilterItem("");
    setFilterStatus("");
  };

  const goBack = () => {
    navigate('/home');
  };

  if (loading) {
    return (
      <div className="status-container">
        <FiLoader className="icon-spin" size={48} />
        <p>LOADING OPERATION LOG...</p>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="status-container error-display">
        <FiAlertTriangle size={48} />
        <p className="error-message">{error}</p>
        <div className="status-actions">
            <button onClick={fetchAllLogs} className="styled-button">Try Again</button>
            <button onClick={() => navigate("/home")} className="styled-button button-secondary">To Main Page</button>
        </div>
      </div>
    );
  }

  const filteredPreviewLogs = getFilteredLogsForPreview();

  return (
    <div className="export-logs-page">
      <div className="page-container">
        <header className="page-header">
          <h1>{"// OPERATION LOG: DATA EXPORT //"}</h1>
          <button className="styled-button back-button" onClick={goBack}>
            <FiArrowLeftCircle className="button-icon" />
            BACK
          </button>
        </header>

        <main className="export-main">
          <section className="filters-section card-style">
            <h2 className="section-title"><FaFilter className="title-icon"/> FILTER PARAMETERS</h2>
            <div className="filter-grid">
              <div className="filter-group">
                <label htmlFor="start-date">PERIOD START:</label>
                <input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label htmlFor="end-date">PERIOD END:</label>
                <input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                />
              </div>

              <div className="filter-group">
                <label htmlFor="filter-action">ACTION TYPE:</label>
                <select
                  id="filter-action"
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                >
                  <option value="">ALL ACTIONS</option>
                  {uniqueActions.map((action) => (
                    <option key={action} value={action}>
                      {action.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-item">OPERATION OBJECT:</label>
                <select
                  id="filter-item"
                  value={filterItem}
                  onChange={(e) => setFilterItem(e.target.value)}
                >
                  <option value="">ALL OBJECTS</option>
                  {uniqueItems.map((item) => (
                    <option key={item} value={item}>
                      {item.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-status">RESULT:</label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">ANY RESULT</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="styled-button button-secondary clear-filters" onClick={clearFilters}>
              <FiX className="button-icon" /> RESET PARAMETERS
            </button>
          </section>

          <section className="preview-section card-style">
            <h2 className="section-title">PREVIEW ({filteredPreviewLogs.length} RECORDS)</h2>
            {filteredPreviewLogs.length > 0 ? (
              <div className="table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>TIME</th>
                      <th>USER</th>
                      <th>ACTION</th>
                      <th>OBJECT</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreviewLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.time ? new Date(log.time).toLocaleString("en-US", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "N/A"}</td>
                        <td>{log.user || "SYSTEM"}</td>
                        <td>{log.action}</td>
                        <td>{log.item || "—"}</td>
                        <td>{log.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data-message">No data available for preview with the selected parameters.</p>
            )}
          </section>

          <section className="export-options card-style">
            <h2 className="section-title"><FaDownload className="title-icon"/> EXPORT TO FILE</h2>
            <div className="format-buttons">
              <button className="styled-button export-button" onClick={() => handleExport("pdf")}>
                PDF
              </button>
              <button className="styled-button export-button" onClick={() => handleExport("csv")}>
                CSV
              </button>
              <button className="styled-button export-button" onClick={() => handleExport("xlsx")}>
                EXCEL (.XLSX)
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default SaveLog;