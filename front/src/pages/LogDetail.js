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
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
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


const LogDetail = () => {
  const { id } = useParams();
  const [log, setLog] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const logId = parseInt(id, 10);
    if (!id || isNaN(logId) || logId <= 0) {
      setError("Неверный или отсутствующий ID записи.");
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
        setError(`Запись с ID ${logId} не найдена.`);
      }
    } catch (err) {
      console.error("Ошибка при получении деталей лога:", err);
      if (err.response) {
        if (err.response.status === 404) {
          setError(`Запись с ID ${logId} не найдена.`);
        } else if (err.response.status === 401 || err.response.status === 403) {
          setError("Ошибка авторизации. Пожалуйста, войдите снова.");
        } else {
          setError(`Не удалось получить информацию о логе (Статус: ${err.response.status}). Пожалуйста, попробуйте еще раз.`);
        }
      } else if (err.request) {
        setError("Сервер не отвечает. Проверьте ваше интернет-соединение.");
      } else {
        setError("Произошла ошибка при подготовке запроса.");
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
        <p>ЗАГРУЗКА ДЕТАЛЕЙ ЗАПИСИ...</p>
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
          Назад к списку логов
        </Link>
      </div>
    );
  }

  if (!log) { 
    return (
      <div className="log-status-container">
        <FiInfo size={48} />
        <p>Данные о логе не найдены или не были загружены.</p>
        <Link to="/logs" className="styled-button back-button-log">
          <FiArrowLeft className="button-icon" />
          Назад к списку логов
        </Link>
      </div>
    );
  }

  const getStatusClass = (status) => {
    if (!status) return 'unknown';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('success') || lowerStatus.includes('успешно') || lowerStatus.includes('ok')) return 'success';
    if (lowerStatus.includes('fail') || lowerStatus.includes('error') || lowerStatus.includes('ошибка')) return 'error';
    if (lowerStatus.includes('warn') || lowerStatus.includes('предупреждение')) return 'warning';
    if (lowerStatus.includes('info') || lowerStatus.includes('информация')) return 'info';
    return 'default'; 
  };


  return (
    <div className="log-detail-page">
      <header className="log-detail-header">
        <h1>{"// ДЕТАЛИЗАЦИЯ ОПЕРАТИВНОЙ ЗАПИСИ //"}</h1>
        <Link to="/home" className="styled-button back-button-header">
          <FiArrowLeft className="button-icon" />
          К СПИСКУ ЗАПИСЕЙ
        </Link>
      </header>

      <main className="log-detail-content">
        <div className="log-card">
          <div className="log-card-header">
            <h2>АНАЛИЗ ЗАПИСИ #{log.id || id}</h2>
          </div>
          <dl className="log-attributes">
            <div className="log-attribute">
              <dt><FiCalendar className="detail-icon" />ВРЕМЯ ФИКСАЦИИ:</dt>
              <dd>{log.time ? new Date(log.time).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Н/Д'}</dd>
            </div>

            <div className="log-attribute">
              <dt><FiUser className="detail-icon" />ОПЕРАТОР:</dt>
              <dd>{log.user_name || log.user || 'НЕ УКАЗАН'}</dd> 
            </div>

            <div className="log-attribute">
              <dt><FiActivity className="detail-icon" />ТИП ОПЕРАЦИИ:</dt>
              <dd>{log.action_type || log.action || 'НЕ УКАЗАН'}</dd> 
            </div>

            {log.weapon && (
              <div className="log-attribute">
                <dt><FiTarget className="detail-icon" />ИСПОЛЬЗОВАНО ОРУЖИЕ:</dt>
                <dd>{log.weapon}</dd>
              </div>
            )}

            {log.special_device && ( 
              <div className="log-attribute">
                <dt><FiCpu className="detail-icon" />СПЕЦ. УСТРОЙСТВО:</dt>
                <dd>{log.special_device || log.special}</dd>
              </div>
            )}
            
            <div className="log-attribute log-attribute-full">
              <dt><FiMessageSquare className="detail-icon" />ДЕТАЛИЗАЦИЯ / КОММЕНТАРИЙ:</dt>
              <dd className="comment-dd">{log.comment || "ОТСУТСТВУЕТ"}</dd>
            </div>

            <div className="log-attribute">
              <dt><FiInfo className="detail-icon" />СТАТУС ОПЕРАЦИИ:</dt>
              <dd>
                <span className={`log-status-badge status-${getStatusClass(log.status)}`}>
                  {log.status || "НЕ ОПРЕДЕЛЕН"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </main>

      <footer className="log-detail-footer">
        <p>&copy; {new Date().getFullYear()}{"// СИСТЕМА ОПЕРАТИВНОГО ЛОГИРОВАНИЯ ПРОТОКОЛ_Z // АРХИВ ЗАПИСЕЙ //"}</p>
      </footer>
    </div>
  );
};

export default LogDetail;