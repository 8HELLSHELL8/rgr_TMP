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
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000", 
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
        console.error("Ошибка авторизации при проверке /api/users/me:", err);
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
      console.error("Ошибка при загрузке оружия:", err);
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          setError("Сессия истекла или доступ запрещен. Пожалуйста, войдите снова.");
          localStorage.removeItem("csrfToken"); 
          navigate("/login", { state: { message: "Пожалуйста, войдите снова." } });
        } else {
          setError(`Не удалось загрузить список оружия. Сервер ответил: ${err.response.data?.message || err.response.status}`);
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
            <p>ЗАГРУЗКА СПИСКА ВООРУЖЕНИЯ...</p>
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
                Перейти на страницу входа
              </button>
              <button onClick={fetchWeapons} className="styled-button button-secondary">
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
    <div className="export-logs-page weapons-page"> 
      <div className="page-container"> 
        <header className="page-header">
          <h1>{"// АРСЕНАЛ: СПИСОК ВООРУЖЕНИЯ //"}</h1>
          <button className="styled-button back-button" onClick={() => navigate(-1)}>
            <FiArrowLeftCircle className="button-icon" />
            Назад
          </button>
        </header>

        <main className="export-main">
          <div className="card-style filters-controls-card">
            <h2 className="section-title">
              <FiFilter className="title-icon" />
              {"// БЛОК УПРАВЛЕНИЯ И ФИЛЬТРАЦИИ //"}
            </h2>
            <div className="filter-grid">
              <div className="filter-group">
                <label htmlFor="filter-type">
                  <FiTag className="label-icon" /> ТИП ВООРУЖЕНИЯ:
                </label>
                <select id="filter-type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">Все типы</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filter-status">
                  <FiActivity className="label-icon" /> БОЕВОЙ СТАТУС:
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
                  <FiList className="label-icon" /> КРИТЕРИЙ СОРТИРОВКИ:
                </label>
                <select id="sort-criteria" value={sortCriteria} onChange={(e) => setSortCriteria(e.target.value)}>
                  <option value="name">По названию (А-Я)</option>
                  <option value="type">По типу</option>
                  <option value="status">По статусу</option>
                  <option value="lastMaintenance">По дате обслуживания (сначала новые)</option>
                </select>
              </div>
            </div>
            <div className="controls-actions">
                <button className="styled-button" onClick={fetchWeapons}>
                    <FiRefreshCw className="button-icon" />
                    Обновить данные с сервера
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
                            {weapon.name || "Н/Д"}
                        </h3>
                    </div>
                    <div className="weapon-card-body">
                        <p><FiTag className="detail-icon" /> <strong>Тип:</strong> {weapon.typeName || "Не указан"}</p>
                        <p><FiActivity className="detail-icon" /> <strong>Статус:</strong> {weapon.statusName || "Не определен"}</p>
                        <p><FiCalendar className="detail-icon" /> <strong>Обслужено:</strong> {weapon.lastMaintenance ? new Date(weapon.lastMaintenance).toLocaleDateString() : "Н/Д"}</p>
                        <p className="description">
                            <FiFileText className="detail-icon" /> 
                            <strong>Описание:</strong> {weapon.description || "Нет описания"}
                        </p>
                    </div>
                    <div className="weapon-card-footer">
                        <span className="styled-button button-sm button-secondary"> 
                            <FiEye className="button-icon"/> Подробнее
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
                    <p className="no-data-message">ЕДИНИЦЫ ВООРУЖЕНИЯ, СООТВЕТСТВУЮЩИЕ КРИТЕРИЯМ, НЕ НАЙДЕНЫ.</p>
                    { (filterType || filterStatus) &&
                        <button
                            className="styled-button button-secondary"
                            onClick={() => { setFilterType(''); setFilterStatus(''); }}
                        >
                            Сбросить фильтры
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