import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom"; // Added useNavigate
import {
  FiCpu,         // Main page icon (or FiTool, FiZap)
  FiArrowLeftCircle,
  FiLoader,
  FiAlertTriangle,
  FiRefreshCw,
  FiFilter,
  FiTag,
  FiActivity,    // Or FiShield for Status
  FiList,        // Or FiBarChart2 for Sort
  FiSlash,
  FiArchive,     // Or FiBox for item title
  FiFileText,
  FiEye,         // Or FiExternalLink for details
} from "react-icons/fi";
import "../css/SpecialsPage.css"; // Ensure this CSS is created and styled

// Axios client setup
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
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

  // Initial Auth Check (optional, can be handled by protected routes or fetch error handling)
  useEffect(() => {
    apiClient.get("/api/users/me") // A common endpoint to check session validity
      .then(() => { /* User is authenticated */ })
      .catch((err) => {
        console.warn("Auth check failed on SpecialsPage mount:", err.message);
        // Don't redirect here, let fetchSpecials handle it to avoid multiple redirects
        // if fetchSpecials itself would also cause an auth error.
      });
  }, []);


  // Функция для загрузки списка спецустройств
  const fetchSpecials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/specials");
      let fetchedSpecials = response.data.specials || response.data || []; // More robust data access

      // Применяем сортировку (client-side)
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
      console.error("Ошибка при загрузке спецустройств:", err);
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          setError("Сессия истекла или доступ запрещен. Пожалуйста, войдите снова.");
          // localStorage.removeItem("csrfToken"); // If applicable
          navigate("/login", { state: { message: "Пожалуйста, войдите снова." } });
        } else {
          setError(`Не удалось загрузить список спецустройств. Сервер ответил: ${err.response.data?.message || err.response.status}`);
        }
      } else if (err.request) {
        setError("Не удалось связаться с сервером. Проверьте ваше интернет-соединение.");
      } else {
        setError("Произошла ошибка при подготовке запроса: " + err.message);
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
            <p>ЗАГРУЗКА СПИСКА СПЕЦУСТРОЙСТВ...</p>
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
               { (error.includes("Сессия истекла") || error.includes("доступ запрещен")) &&
                <button onClick={() => navigate("/login")} className="styled-button">
                    Перейти на страницу входа
                </button>
               }
              <button onClick={fetchSpecials} className="styled-button button-secondary">
                <FiRefreshCw className="button-icon" />
                Попробовать снова
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
            <FiCpu className="header-icon" /> {/* Or FiTool, FiZap */}
            {"// СПЕЦИАЛЬНОЕ ОБОРУДОВАНИЕ //"}
          </h1>
          <button className="styled-button back-button" onClick={() => navigate(-1)}>
            <FiArrowLeftCircle className="button-icon" />
            {"Назад"}
          </button>
        </header>

        <main className="export-main">
          <div className="card-style filters-controls-card">
            <h2 className="section-title">
              <FiFilter className="title-icon" />
              {"// ПАНЕЛЬ УПРАВЛЕНИЯ И ФИЛЬТРАЦИИ //"}
            </h2>
            <div className="filter-grid">
              <div className="filter-group">
                <label htmlFor="filter-type">
                  <FiTag className="label-icon" /> {"Категория устройства:"}
                </label>
                <select id="filter-type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">Все категории</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-status">
                  <FiActivity className="label-icon" /> Текущий Статус:
                </label>
                <select id="filter-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">Все статусы</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="sort-criteria">
                  <FiList className="label-icon" /> Алгоритм Сортировки:
                </label>
                <select id="sort-criteria" value={sortCriteria} onChange={(e) => setSortCriteria(e.target.value)}>
                  <option value="name">По наименованию (А-Я)</option>
                  <option value="type">По категории</option>
                  <option value="status">По статусу</option>
                </select>
              </div>
            </div>
            <div className="controls-actions">
                <button className="styled-button" onClick={fetchSpecials}>
                    <FiRefreshCw className="button-icon" />
                    Обновить данные с сервера
                </button>
            </div>
          </div>
          
          {error && <p className="error-message inline-error"><FiAlertTriangle/> {error}</p>}

          {filteredSpecials.length > 0 ? (
            <ul className="item-list special-list"> {/* Generic item-list class + specific */}
              {filteredSpecials.map((special) => (
                <li key={special.id} className="item-card-item special-card-item card-style">
                  <Link to={`/specials/${special.id}`} className="item-link-wrapper">
                    <div className="item-card-header">
                        <h3>
                            <FiArchive className="title-icon"/> {/* Or FiBox */}
                            {special.name || "Н/Д"}
                        </h3>
                    </div>
                    <div className="item-card-body">
                        <p><FiTag className="detail-icon" /> <strong>Категория:</strong> {special.typeName || "Не указана"}</p>
                        <p><FiActivity className="detail-icon" /> <strong>Статус:</strong> {special.statusName || "Не определен"}</p>
                        <p className="description">
                            <FiFileText className="detail-icon" /> 
                            <strong>Описание:</strong> {special.description || "Краткое описание отсутствует."}
                        </p>
                    </div>
                    <div className="item-card-footer">
                        <span className="styled-button button-sm button-secondary">
                            <FiEye className="button-icon"/> Просмотреть детали
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
                    <p className="no-data-message">СПЕЦУСТРОЙСТВА, СООТВЕТСТВУЮЩИЕ КРИТЕРИЯМ, НЕ ОБНАРУЖЕНЫ.</p>
                    { (filterType || filterStatus) &&
                        <button
                            className="styled-button button-secondary"
                            onClick={() => { setFilterType(''); setFilterStatus(''); }}
                        >
                            Сбросить активные фильтры
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