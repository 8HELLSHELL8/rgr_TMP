import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import {
  FiCpu,
  FiLoader,
  FiAlertTriangle,
  FiArrowLeft,
  FiFileText,
  FiTag,
  FiActivity,
  FiInfo // For general info or fallback
} from "react-icons/fi";
import "../css/SpecialDetailsPage.css"; // We will create this

// Axios client
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

// CSRF Interceptor (consistent with other pages)
apiClient.interceptors.request.use(
  (config) => {
    const methodsRequiringCsrf = ["post", "put", "delete", "patch"];
    if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
      const csrfToken = localStorage.getItem("csrfToken");
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      } else {
        console.warn(
          "CSRF токен не найден в localStorage для изменяющего запроса."
        );
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const SpecialDetailsPage = () => {
  const { id } = useParams();
  const [special, setSpecial] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true

  const fetchSpecial = useCallback(async () => {
    if (!id || isNaN(parseInt(id, 10)) || parseInt(id, 10) <= 0) {
        setError("Неверный или отсутствующий ID объекта.");
        setLoading(false);
        setSpecial(null);
        return;
    }
    setLoading(true); // Ensure loading is true at the start of fetch
    setError(null); // Clear previous errors
    try {
      const response = await apiClient.get(`/api/specials/${id}`);
      // Ensure response.data and response.data.special exist
      if (response.data && response.data.special) {
        setSpecial(response.data.special);
      } else {
        setSpecial(null); // Explicitly set to null if not found in response
        setError(`Объект с ID ${id} не найден или данные некорректны.`);
      }
    } catch (err) {
      console.error("Ошибка при загрузке данных об объекте:", err);
      if (err.response) {
        if (err.response.status === 404) {
          setError(`Объект с ID ${id} не найден.`);
        } else if (err.response.status === 401 || err.response.status === 403) {
          setError("Ошибка авторизации. Пожалуйста, войдите снова.");
          // Consider redirecting to login: navigate("/login", { state: { message: "Сессия истекла." } });
        } else {
          setError(`Не удалось загрузить данные (Статус: ${err.response.status}).`);
        }
      } else if (err.request) {
        setError("Сервер не отвечает. Проверьте ваше интернет-соединение.");
      } else {
        setError("Произошла ошибка при подготовке запроса.");
      }
      setSpecial(null); // Ensure special is null on error
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSpecial();
  }, [fetchSpecial]);

  const getStatusClass = (statusName) => {
    if (!statusName) return 'unknown';
    const lowerStatus = statusName.toLowerCase();
    // Add more specific status keywords as needed
    if (lowerStatus.includes('active') || lowerStatus.includes('активен') || lowerStatus.includes('online') || lowerStatus.includes('включен')) return 'success';
    if (lowerStatus.includes('inactive') || lowerStatus.includes('неактивен') || lowerStatus.includes('offline') || lowerStatus.includes('выключен')) return 'error';
    if (lowerStatus.includes('pending') || lowerStatus.includes('ожидание') || lowerStatus.includes('maintenance') || lowerStatus.includes('обслуживание')) return 'warning';
    if (lowerStatus.includes('standby') || lowerStatus.includes('в резерве')) return 'info';
    return 'default';
  };


  if (loading) {
    return (
      <div className="status-container-special">
        <FiLoader className="icon-spin" size={48} />
        <p>{"ЗАГРУЗКА ДАННЫХ ОПЕРАТИВНОГО ОБЪЕКТА..."}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="status-container-special error-container-special">
        <FiAlertTriangle size={48} />
        <p className="error-text">{error}</p>
        <Link to="/specials" className="styled-button back-button-special">
          <FiArrowLeft className="button-icon" />
          {"Назад к списку объектов"}
        </Link>
      </div>
    );
  }

  if (!special) {
    return (
      <div className="status-container-special">
        <FiInfo size={48} />
        <p>{"Данные об объекте не найдены или не были загружены."}</p>
        <Link to="/specials" className="styled-button back-button-special">
          <FiArrowLeft className="button-icon" />
          {"Назад к списку объектов"}
        </Link>
      </div>
    );
  }

  return (
    <div className="special-details-page">
      <header className="special-details-header">
        <h1>
          <FiCpu className="header-icon" />
          {"// ОБЪЕКТ:"} {special.name || "БЕЗ ИМЕНИ"} {"//"}
        </h1>
        <Link to="/specials" className="styled-button back-button-header-special">
          <FiArrowLeft className="button-icon" />
          {"К СПИСКУ ОБЪЕКТОВ"}
        </Link>
      </header>

      <main className="special-details-content">
        <div className="special-card">
          <div className="special-card-header">
            <h2>{"АНАЛИТИЧЕСКАЯ СПРАВКА ПО ОБЪЕКТУ"} #{special.id || id}</h2>
          </div>
          <dl className="special-attributes">
            <div className="special-attribute special-attribute-full">
              <dt><FiFileText className="detail-icon" />{"ОПИСАНИЕ / НАЗНАЧЕНИЕ:"}</dt>
              <dd className="description-dd">{special.description || "ОТСУТСТВУЕТ"}</dd>
            </div>

            <div className="special-attribute">
              <dt><FiTag className="detail-icon" />{"КЛАССИФИКАЦИЯ / ТИП:"}</dt>
              <dd>{special.type_name || special.typeName || "НЕ УКАЗАН"}</dd>
            </div>

            <div className="special-attribute">
              <dt><FiActivity className="detail-icon" />{"ТЕКУЩИЙ СТАТУС:"}</dt>
              <dd>
                <span className={`status-badge-special status-${getStatusClass(special.status_name || special.statusName)}`}>
                  {special.status_name || special.statusName || "НЕ ОПРЕДЕЛЕН"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </main>

      <footer className="special-details-footer">
        <p>&copy; {new Date().getFullYear()} {"// СИСТЕМА УЧЕТА СПЕЦИАЛЬНЫХ ОБЪЕКТОВ // АРХИВ_SYGMA-7 //"}</p>
      </footer>
    </div>
  );
};

export default SpecialDetailsPage;