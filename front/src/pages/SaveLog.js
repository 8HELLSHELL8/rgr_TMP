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
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
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
      console.error("Ошибка при загрузке логов:", err);
      if (err.response && err.response.status === 401) {
        setError("Ошибка авторизации. Пожалуйста, войдите снова.");
        navigate('/login');
      } else {
        setError("Не удалось загрузить данные о логах. Попробуйте обновить страницу.");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]); // Add any other dependencies used inside the function

  useEffect(() => {
    fetchAllLogs();
  }, [fetchAllLogs]); // Now we can safely add it to dependencies

  

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
        const endOfDay = new Date(end);
        inTimeRange = dateLog <= endOfDay;
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
      alert("Предпросмотр пуст согласно текущим фильтрам. Экспорт может не содержать данных, если серверные фильтры совпадут. Продолжить экспорт?");
    }

    const endpoint = `/api/logs/export/${exportType}`;
    const filename = `security_logs_${new Date().toISOString().split('T')[0]}.${exportType}`;
    let blobType = "";

    switch (exportType) {
      case "pdf": blobType = "application/pdf"; break;
      case "csv": blobType = "text/csv;charset=utf-8;"; break;
      case "xlsx": blobType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; break;
      default: alert("Неизвестный формат экспорта."); return;
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
          alert("Нет данных для экспорта на сервере по указанным фильтрам.");
          return;
      }
      if (response.data.type === 'application/json') {
        const errorJson = JSON.parse(await response.data.text());
        alert(`Ошибка экспорта: ${errorJson.message || 'Неизвестная ошибка от сервера.'}`);
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
      console.error(`Ошибка при экспорте ${exportType.toUpperCase()}:`, error);
      let message = `Не удалось скачать логи в формате ${exportType.toUpperCase()}.`;
      if (error.response) {
          if (error.response.status === 401) message = "Ошибка авторизации. Пожалуйста, войдите снова.";
          else if (error.response.status === 403) message = "Ошибка CSRF токена или недостаточно прав.";
          else if (error.response.status === 404) message = "Данные для экспорта по указанным фильтрам не найдены на сервере.";
          else if (error.response.data) {
            try {
                const errorText = await error.response.data.text();
                const errorJson = JSON.parse(errorText);
                if (errorJson && errorJson.message) message = errorJson.message;
            } catch (parseError) {
                message = `Сервер ответил ошибкой ${error.response.status}.`;
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
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="status-container">
        <FiLoader className="icon-spin" size={48} />
        <p>ЗАГРУЗКА ЖУРНАЛА ОПЕРАЦИЙ...</p>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="status-container error-display">
        <FiAlertTriangle size={48} />
        <p className="error-message">{error}</p>
        <div className="status-actions">
            <button onClick={fetchAllLogs} className="styled-button">Попробовать снова</button>
            <button onClick={() => navigate("/home")} className="styled-button button-secondary">На главную</button>
        </div>
      </div>
    );
  }

  const filteredPreviewLogs = getFilteredLogsForPreview();

  return (
    <div className="export-logs-page">
      <div className="page-container"> 
        <header className="page-header">
          <h1>{"// ЖУРНАЛ ОПЕРАЦИЙ: ЭКСПОРТ ДАННЫХ //"}</h1>
          <button className="styled-button back-button" onClick={goBack}>
            <FiArrowLeftCircle className="button-icon" />
            НАЗАД
          </button>
        </header>

        <main className="export-main">
          <section className="filters-section card-style">
            <h2 className="section-title"><FaFilter className="title-icon"/> ПАРАМЕТРЫ ФИЛЬТРАЦИИ</h2>
            <div className="filter-grid">
              <div className="filter-group">
                <label htmlFor="start-date">НАЧАЛО ПЕРИОДА:</label>
                <input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label htmlFor="end-date">КОНЕЦ ПЕРИОДА:</label>
                <input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                />
              </div>

              <div className="filter-group">
                <label htmlFor="filter-action">ТИП ДЕЙСТВИЯ:</label>
                <select
                  id="filter-action"
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                >
                  <option value="">ВСЕ ДЕЙСТВИЯ</option>
                  {uniqueActions.map((action) => (
                    <option key={action} value={action}>
                      {action.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-item">ОБЪЕКТ ОПЕРАЦИИ:</label>
                <select
                  id="filter-item"
                  value={filterItem}
                  onChange={(e) => setFilterItem(e.target.value)}
                >
                  <option value="">ВСЕ ОБЪЕКТЫ</option>
                  {uniqueItems.map((item) => (
                    <option key={item} value={item}>
                      {item.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-status">РЕЗУЛЬТАТ:</label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">ЛЮБОЙ РЕЗУЛЬТАТ</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className="styled-button button-secondary clear-filters" onClick={clearFilters}>
              <FiX className="button-icon" /> СБРОСИТЬ ПАРАМЕТРЫ
            </button>
          </section>

          <section className="preview-section card-style">
            <h2 className="section-title">ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР ({filteredPreviewLogs.length} ЗАПИСЕЙ)</h2>
            {filteredPreviewLogs.length > 0 ? (
              <div className="table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>ВРЕМЯ</th>
                      <th>ПОЛЬЗОВАТЕЛЬ</th>
                      <th>ДЕЙСТВИЕ</th>
                      <th>ОБЪЕКТ</th>
                      <th>СТАТУС</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreviewLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.time ? new Date(log.time).toLocaleString("ru-RU", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Н/Д"}</td>
                        <td>{log.user || "СИСТЕМА"}</td>
                        <td>{log.action}</td>
                        <td>{log.item || "—"}</td>
                        <td>{log.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data-message">Данные для предпросмотра отсутствуют согласно выбранным параметрам.</p>
            )}
          </section>

          <section className="export-options card-style">
            <h2 className="section-title"><FaDownload className="title-icon"/> ЭКСПОРТ В ФАЙЛ</h2>
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