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
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
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


const Home = ({ finalizeLogoutProcess, apiClient }) => { // Receive props here
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [sortCriteria, setSortCriteria] = useState("time-desc");
  const [filterAction, setFilterAction] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [userDisplayName, setUserDisplayName] = useState("Оператор");

  const navigate = useNavigate();

  // Use the apiClient passed as a prop.
  // If no apiClient prop is guaranteed, you might want a fallback or to ensure it's always passed.
  const currentApiClient = apiClient; // Assuming apiClient prop is always provided by App.js

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const userData = JSON.parse(userString);
        setUserDisplayName(userData.username || `${userData.name} ${userData.surname}`.trim() || "Оператор");
      } catch (e) {
        console.error("Ошибка парсинга данных пользователя из localStorage:", e);
        // setUserDisplayName("Оператор"); // Fallback already set
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
        setError("Ошибка конфигурации: API клиент не доступен.");
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
      console.error("Ошибка при загрузке логов:", err);
      if (err.response && err.response.status === 401) {
        showMessage("Сессия истекла или нет авторизации. Перенаправление на вход...", "error", 3000);
        // If session expires, App.js's finalizeLogoutProcess should handle full logout and redirect
        if (finalizeLogoutProcess) {
            setTimeout(() => finalizeLogoutProcess(), 3000);
        } else {
            setTimeout(() => navigate("/"), 3000); // Fallback
        }
      } else {
        setError("Не удалось загрузить оперативные сводки. Попробуйте обновить.");
      }
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [sortCriteria, navigate, currentApiClient, finalizeLogoutProcess]); // Added dependencies

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const uniqueActions = React.useMemo(() => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(), [logs]);
  const uniqueItems = React.useMemo(() => [...new Set(logs.map((log) => log.item).filter(Boolean))].sort(), [logs]);
  const uniqueStatuses = React.useMemo(() => [...new Set(logs.map((log) => log.status).filter(Boolean))].sort(), [logs]);

  const filteredLogs = React.useMemo(() => logs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const timeString = log.time ? new Date(log.time).toLocaleString('ru-RU').toLowerCase() : "";

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
        showMessage("Ошибка конфигурации для выхода.", "error");
        // Fallback to basic cleanup if finalizeLogoutProcess is also missing
        if (!finalizeLogoutProcess) {
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            window.location.href = "/";
        } else {
            finalizeLogoutProcess(); // Try to finalize even without API client for logout call
        }
        return;
    }

    showMessage("Выход из системы...", "info", 10000);

    try {
      await currentApiClient.post("/api/logout", {});
      showMessage("Выход из системы успешно выполнен на сервере.", "success", 2000);

      setTimeout(() => {
        if (finalizeLogoutProcess) { // Prop is correctly referenced here
          finalizeLogoutProcess();
        } else {
          console.error("finalizeLogoutProcess prop not available in Home.js. Performing manual cleanup.");
          localStorage.removeItem("authToken");
          localStorage.removeItem("csrfToken");
          localStorage.removeItem("user");
          window.location.href = "/";
        }
      }, 1500);

    } catch (err) {
      console.error("Ошибка при выходе (API call or subsequent process):", err);
      showMessage("Ошибка при выходе. Производится принудительная очистка...", "error", 3000);

      setTimeout(() => {
        if (finalizeLogoutProcess) { // Prop is correctly referenced here
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
            <span className="header-app-title">СИСТЕМА ОПЕРАТИВНОГО УЧЕТА</span>
          </div>
          <div className="header-user-controls">
            <button className="styled-button icon-button" title={userDisplayName} onClick={() => navigate("/profile")}>
              <FiUser /> <span>{userDisplayName}</span>
            </button>
            <button className="styled-button icon-button" title="Выход" onClick={handleLogout}>
              <FiPower /> <span>Выход</span>
            </button>
          </div>
        </div>
        <nav className="header-nav-actions">
            <button className="styled-button nav-action-button" onClick={() => navigate("/make-action")}>
              <FiEdit3 /> Новая Запись
            </button>
            <button className="styled-button nav-action-button" onClick={() => navigate("/logs/download")}> {/* Assuming this route exists in App.js */}
              <FiDownloadCloud /> Экспорт Журнала
            </button>
        </nav>
      </header>

      <main className="home-main-content">
        <div className="page-container">
          <h1 className="main-page-title"><FiGrid /> ПАНЕЛЬ УПРАВЛЕНИЯ</h1>

          <section className="quick-access-section card-style">
            <h2 className="section-title"><FiPocket /> ИНВЕНТАРЬ И РЕСУРСЫ</h2>
            <div className="buttons-grid">
              <button className="styled-button quick-access-button" onClick={() => navigate("/weapons")}>
                <FiHardDrive /> УЧЕТ ВООРУЖЕНИЯ
              </button>
              <button className="styled-button quick-access-button" onClick={() => navigate("/specials")}>
                <FiCpu /> УЧЕТ СПЕЦСРЕДСТВ
              </button>
            </div>
          </section>

          <section className="logs-section card-style">
            <div className="logs-header">
              <h2 className="section-title"><FiList /> ОПЕРАТИВНАЯ СВОДКА</h2>
              <button className="styled-button icon-button refresh-logs-button" onClick={fetchLogs} disabled={loadingLogs || !currentApiClient}>
                {loadingLogs ? <FiLoader className="icon-spin" /> : <FiRefreshCw />}
                {loadingLogs ? "ЗАГРУЗКА..." : (!currentApiClient ? "API НЕ ДОСТУПЕН" : "ОБНОВИТЬ")}
              </button>
            </div>

            <div className="search-filter-bar">
                <div className="search-container">
                <FiSearch className="search-input-icon" />
                <input
                    type="text"
                    placeholder="Поиск по сводкам..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                </div>
            </div>

            <div className="filters-sort-container">
              <h3 className="filters-title"><FiFilter/> Фильтры и сортировка</h3>
              <div className="filter-controls-grid">
                <div className="filter-group">
                  <label htmlFor="filter-action">ДЕЙСТВИЕ:</label>
                  <select id="filter-action" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
                    <option value="">ВСЕ</option>
                    {uniqueActions.map((action) => <option key={action} value={action}>{action.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-item">ОБЪЕКТ:</label>
                  <select id="filter-item" value={filterItem} onChange={(e) => setFilterItem(e.target.value)}>
                    <option value="">ВСЕ</option>
                    {uniqueItems.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-status">СТАТУС:</label>
                  <select id="filter-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">ВСЕ</option>
                    {uniqueStatuses.map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="sort-criteria">СОРТИРОВКА:</label>
                  <select id="sort-criteria" value={sortCriteria} onChange={(e) => setSortCriteria(e.target.value)}>
                    <option value="time-desc">ПО ВРЕМЕНИ (НОВЫЕ)</option>
                    <option value="time-asc">ПО ВРЕМЕНИ (СТАРЫЕ)</option>
                    <option value="action">ПО ДЕЙСТВИЮ</option>
                    <option value="item">ПО ОБЪЕКТУ</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="logs-display-area">
                {error && <p className="status-message error-message"><FiAlertCircle /> {error}</p>}
                {(!currentApiClient && !error) && <p className="status-message error-message"><FiAlertCircle /> Ошибка конфигурации: API клиент не предоставлен.</p>}
                {loadingLogs && !error && currentApiClient && <div className="status-container inline-loader"><FiLoader className="icon-spin" size={32}/><p>ЗАГРУЗКА СВОДОК...</p></div>}

                {!loadingLogs && !error && currentApiClient && filteredLogs.length > 0 && (
                <ul className="logs-list">
                    {filteredLogs.map((log) => (
                    <li key={log.id} className="log-item">
                        <Link to={`/logs/full/${log.id}`} className="log-link-content">
                            <div className="log-meta">
                                <span className="log-time">{log.time ? new Date(log.time).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                                <span className="log-status-badge" data-status={log.status?.toLowerCase()}>{log.status || "N/A"}</span>
                            </div>
                            <div className="log-details">
                                <span className="log-user"><FiUser className="log-detail-icon"/> {log.user || "Система"}</span>
                                <span className="log-action"><FiTarget className="log-detail-icon"/> {log.action || "Не указано"}</span>
                                {log.item && <span className="log-item-name"><FiCpu className="log-detail-icon"/> {log.item}</span>}
                            </div>
                            <FiEye className="log-view-indicator" title="Детали"/>
                        </Link>
                    </li>
                    ))}
                </ul>
                )}
                {!loadingLogs && !error && currentApiClient && logs.length > 0 && filteredLogs.length === 0 && (
                    <p className="status-message no-results-message">По заданным параметрам сводки не найдены.</p>
                )}
                {!loadingLogs && !error && currentApiClient && logs.length === 0 && (
                    <p className="status-message no-results-message">Оперативные сводки отсутствуют.</p>
                )}
            </div>
          </section>
        </div>
      </main>

      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} СЕКТОР АЛЬФА-7. КОНТРОЛЬ ОПЕРАЦИЙ. ДОСТУП ОГРАНИЧЕН.</p>
      </footer>
    </div>
  );
};

export default Home;