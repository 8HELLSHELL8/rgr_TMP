import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FiUser,
  FiShield,
  FiMail,
  FiAlertTriangle,
  FiLoader,
  FiArrowLeftCircle,
  FiTag 
} from "react-icons/fi";
import "../css/ProfilePage.css"; 

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  withCredentials: true, 
});

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

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get("/api/users/me");
        if (response.data && response.data.user) {
          setUser(response.data.user);
        } else if (response.data && !response.data.user) {
          setUser(response.data);
          console.warn(
            "Ответ API '/api/users/me' не содержит поля 'user'. Используется response.data напрямую."
          );
        } else {
          throw new Error("Ответ API не содержит данных пользователя.");
        }
      } catch (err) {
        console.error("Ошибка при получении данных пользователя:", err);
        if (err.response) {
          console.error("Данные ответа об ошибке:", err.response.data);
          console.error("Статус ответа об ошибке:", err.response.status);
          if (err.response.status === 401 || err.response.status === 403) {
            setError("Ошибка авторизации. Возможно, ваша сессия истекла.");
            localStorage.removeItem("csrfToken");
            navigate("/login", {
              state: { message: "Пожалуйста, войдите снова." },
            });
          } else {
            setError(
              `Не удалось получить данные пользователя. Сервер ответил: ${
                err.response.data?.message || err.response.status
              }`
            );
          }
        } else if (err.request) {
          setError(
            "Не удалось связаться с сервером. Проверьте ваше интернет-соединение."
          );
        } else {
          setError(
            "Произошла ошибка при подготовке запроса: " + err.message
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  if (loading)
    return (
      <div className="profile-status-container">
        <FiLoader className="icon-spin" size={48} />
        <p>ЗАГРУЗКА ПРОФИЛЯ...</p>
      </div>
    );

  if (error && !user)
    return (
      <div className="profile-status-container error-container">
        <FiAlertTriangle size={48} />
        <p className="error-message">{error}</p>
        <button onClick={() => navigate("/login")} className="styled-button">
          Попробовать войти
        </button>
      </div>
    );

  if (!user)
    return (
      <div className="profile-status-container error-container">
        <FiAlertTriangle size={48} />
        <p className="error-message">
          Данные пользователя не найдены или не удалось загрузить.
        </p>
      </div>
    );

  const fullName = `${user.surname || ""} ${user.name || ""} ${
    user.lastname || ""
  }`
    .replace(/\s+/g, " ")
    .trim();

  return (
    <div className="profile-page">
      <div className="profile-container">
        <header className="profile-header">
          <h1>ACCESS GRANTED: USER PROFILE</h1>
        </header>

        <main className="profile-main">
          <div className="profile-card">
            <div className="profile-card-header">
              <h2>{"// ИНФОРМАЦИОННЫЙ БЛОК //"}</h2>
            </div>
            <dl className="profile-details">
              <div className="profile-detail-item">
                <dt>
                  <FiUser className="detail-icon" />
                  ОПЕРАТОР:
                </dt>
                <dd>{fullName || "Н/Д"}</dd>
              </div>

              <div className="profile-detail-item">
                <dt>
                  <FiShield className="detail-icon" />
                  КЛАССИФИКАЦИЯ:
                </dt>
                <dd>{user.role?.name || "НЕ ОПРЕДЕЛЕНА"}</dd>
              </div>

              {user.username && (
                <div className="profile-detail-item">
                  <dt>
                    <FiTag className="detail-icon" /> 
                    ПОЗЫВНОЙ:
                  </dt>
                  <dd>{user.username}</dd>
                </div>
              )}
              
              {user.email && (
                <div className="profile-detail-item">
                  <dt>
                    <FiMail className="detail-icon" />
                    КАНАЛ СВЯЗИ (EMAIL):
                  </dt>
                  <dd>{user.email}</dd>
                </div>
              )}
            </dl>
          </div>
          <button
            onClick={() => navigate(-1)} 
            className="styled-button back-button"
          >
            <FiArrowLeftCircle className="button-icon" />
            ВЕРНУТЬСЯ
          </button>
        </main>
      </div>
    </div>
  );
};

export default Profile;