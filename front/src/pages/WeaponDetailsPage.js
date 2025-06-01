import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useParams, Link, useNavigate } from "react-router-dom"; // Added useNavigate
import {
  FiTarget,    // For weapon name/header
  FiArrowLeftCircle,
  FiInfo,      // For "Information" section title
  FiFileText,  // Description
  FiTag,       // Type
  FiActivity,  // Status (or FiShield)
  FiCalendar,  // Last Maintenance
  FiLoader,
  FiAlertTriangle,
  FiRefreshCw  // For retry button
} from "react-icons/fi";
import "../css/WeaponDetailsPage.css"; // Ensure this CSS is created and styled

// Axios client setup
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  withCredentials: true,
});

const WeaponDetailsPage = () => {
  const { id } = useParams();
  const [weapon, setWeapon] = useState(null);
  const [loading, setLoading] = useState(true); // Added loading state
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // For navigation

  const fetchWeapon = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/api/weapons/${id}`);
      if (response.data && (response.data.weapon || response.data)) {
        setWeapon(response.data.weapon || response.data); // Handle if 'weapon' wrapper is not present
      } else {
        throw new Error("Данные об оружии не найдены в ответе API.");
      }
    } catch (err) {
      console.error("Ошибка при загрузке данных об оружии:", err);
      if (err.response) {
         if (err.response.status === 401 || err.response.status === 403) {
          setError("Ошибка авторизации или сессия истекла.");
          navigate("/login", { state: { message: "Пожалуйста, войдите снова." } });
        } else if (err.response.status === 404) {
          setError("Единица вооружения с таким ID не найдена.");
        } else {
          setError(`Не удалось загрузить данные. Сервер ответил: ${err.response.data?.message || err.response.status}`);
        }
      } else if (err.request) {
        setError("Не удалось связаться с сервером. Проверьте ваше интернет-соединение.");
      } else {
        setError("Произошла ошибка при подготовке запроса: " + err.message);
      }
      setWeapon(null); // Clear weapon data on error
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
            <p>{"ЗАГРУЗКА ДАННЫХ О ЕДИНИЦЕ ВООРУЖЕНИЯ..."}</p>
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
                {"К списку вооружения"}
              </Link>
              <button onClick={fetchWeapon} className="styled-button">
                <FiRefreshCw className="button-icon" />
                {"Попробовать снова"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!weapon) {
    // This case should ideally be covered by loading or error states,
    // but as a fallback:
    return (
      <div className="export-logs-page weapon-details-page">
        <div className="page-container">
          <div className="status-container error-display">
            <FiAlertTriangle size={48} />
            <p className="error-message">{"Данные об оружии не найдены или не удалось загрузить."}</p>
             <Link to="/weapons" className="styled-button">
                <FiArrowLeftCircle className="button-icon" />
                {"К списку вооружения"}
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
            {"// ОБЪЕКТ:"} {weapon.name || "Н/Д"} {"//"}
          </h1>
          <Link to="/weapons" className="styled-button back-button">
            <FiArrowLeftCircle className="button-icon" />
            {"Назад к списку"}
          </Link>
        </header>

        <main className="export-main">
          <div className="card-style weapon-info-card">
            <h2 className="section-title">
              <FiInfo className="title-icon" />
              {"// ТЕХНИЧЕСКАЯ СПРАВКА //"}
            </h2>
            <dl className="details-list">
              <div className="detail-item">
                <dt>
                  <FiTag className="detail-icon" />
                  {"Классификация (Тип):"}
                </dt>
                <dd>{weapon.typeName || "Не указан"}</dd>
              </div>

              <div className="detail-item">
                <dt>
                  <FiActivity className="detail-icon" />
                  {"Оперативный Статус:"}
                </dt>
                <dd>{weapon.statusName || "Не указан"}</dd>
              </div>

              <div className="detail-item">
                <dt>
                  <FiCalendar className="detail-icon" />
                  {"Дата последнего ТО:"}
                </dt>
                <dd>
                  {weapon.lastMaintenance
                    ? new Date(weapon.lastMaintenance).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' }) // Example with better formatting
                    : "Не проводилось"}
                </dd>
              </div>

              <div className="detail-item description-item">
                <dt>
                  <FiFileText className="detail-icon" />
                  {"Тактическое Описание:"}
                </dt>
                <dd className="description-text">
                  {weapon.description || "Детальное описание отсутствует."}
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