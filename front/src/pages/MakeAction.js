import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiAlertTriangle, FiLoader, FiArrowLeftCircle } from "react-icons/fi"; 
import "../css/MakeAction.css"; 

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
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method.toUpperCase())) {
      const csrfToken = getCookie('csrf-token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      } else {
        console.warn('CSRF token cookie not found. Requests requiring CSRF protection might fail.');
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const MakeAction = () => {
  const [soldiers, setSoldiers] = useState([]);
  const [actions, setActions] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [specials, setSpecials] = useState([]);
  const [actionStatuses, setActionStatuses] = useState([]);

  const [selectedSoldier, setSelectedSoldier] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedWeapon, setSelectedWeapon] = useState(null); 
  const [selectedSpecial, setSelectedSpecial] = useState(null); 
  const [selectedStatus, setSelectedStatus] = useState("");
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const fetchGenericData = async (url, setter, itemName) => {
    try {
      const response = await apiClient.get(url);
      if (response.data && typeof response.data === 'object') {
        setter(response.data[itemName] || response.data.data || response.data || []);
      } else {
        setter([]); 
        console.warn(`Unexpected data structure from ${url}:`, response.data);
      }
    } catch (err) {
      console.error(`Ошибка при получении ${url}:`, err);
      throw err;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!isMounted) return;
      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        await Promise.all([
          fetchGenericData("/api/soldiers", setSoldiers, "soldiers"),
          fetchGenericData("/api/actions", setActions, "actions"),
          fetchGenericData("/api/weapons", setWeapons, "weapons"),
          fetchGenericData("/api/specials", setSpecials, "specials"),
          fetchGenericData("/api/action-statuses", setActionStatuses, "actionStatuses"),
        ]);
      } catch (err) {
        if (isMounted) {
          let errorMessage = "Ошибка при загрузке необходимых данных.";
          if (err.response && err.response.status === 401) {
            errorMessage = "Ошибка авторизации. Пожалуйста, войдите снова.";
            navigate('/login'); 
          } else if (err.message) {
            errorMessage = err.message;
          }
          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!selectedSoldier || !selectedAction || !selectedStatus) {
      setError("Обязательные поля: СОЛДАТ, ДЕЙСТВИЕ, СТАТУС - должны быть заполнены.");
      return;
    }

    setLoading(true); 
    try {
      const payload = {
        soldier: selectedSoldier,          
        action_type: selectedAction,      
        status: selectedStatus,            
        gun_taken: selectedWeapon === "" ? null : selectedWeapon, 
        specials_taken: selectedSpecial === "" ? null : selectedSpecial, 
        comment: comment.trim() || null,
      };
      const response = await apiClient.post("/api/logs", payload);

      if (response.data && (response.data.success || response.status === 201 || response.status === 200)) {
        setSuccess(true);
        setError(null);
        setTimeout(() => {
          navigate("/"); 
        }, 2500);
      } else {
        setError(response.data.message || "Не удалось создать запись. Проверьте данные.");
      }
    } catch (err) {
      console.error("Ошибка при создании записи:", err);
      let specificError = "Произошла ошибка. Не удалось создать запись.";
      if (err.response) {
        if (err.response.status === 401) {
          specificError = "Ошибка авторизации. Ваша сессия могла истечь.";
          navigate('/login');
        } else if (err.response.status === 403) {
           specificError = err.response.data.message || "Ошибка CSRF токена или недостаточно прав.";
        } else if (err.response.status === 400 && err.response.data && err.response.data.errors) {
            const Verrors = Object.values(err.response.data.errors).join(', ');
            specificError = `Ошибка валидации: ${Verrors}`;
        } else if (err.response.status === 500) {
          specificError = "Внутренняя ошибка сервера. Попробуйте позже.";
        } else if (err.response.data && err.response.data.message) {
           specificError = err.response.data.message;
        }
      } else if (err.request) {
        specificError = "Сервер не отвечает. Проверьте ваше соединение.";
      }
      setError(specificError);
      setSuccess(false);
    } finally {
        if (!success) setLoading(false); 
    }
  };
  
  const goBack = () => navigate(-1);

  if (loading && !success) { 
    return (
      <div className="status-container">
        <FiLoader className="icon-spin" size={48} />
        <p>ЗАГРУЗКА ДАННЫХ ФОРМЫ...</p>
      </div>
    );
  }
  
  if (error && !soldiers.length && !actions.length && !actionStatuses.length) { 
    return (
      <div className="status-container error-display">
        <FiAlertTriangle size={48} />
        <p className="error-message">{error}</p>
        <button onClick={goBack} className="styled-button button-secondary">
          <FiArrowLeftCircle className="button-icon"/> НАЗАД
        </button>
      </div>
    );
  }


  return (
    <div className="make-action-page">
      <div className="page-container">
        <header className="page-header">
          <h1>{"// ОПЕРАТИВНЫЙ ЖУРНАЛ: РЕГИСТРАЦИЯ ДЕЙСТВИЯ //"}</h1>
          <button className="styled-button button-secondary back-button" onClick={goBack}>
            <FiArrowLeftCircle className="button-icon" />
            ОТМЕНА
          </button>
        </header>

        <main className="make-action-main card-style">
          {success && (
            <div className="status-container success-display">
              <FiCheckCircle size={60} />
              <p>ЗАПИСЬ УСПЕШНО ЗАРЕГИСТРИРОВАНА!</p>
              <p className="redirect-info">Перенаправление...</p>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="action-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="soldier">ОПЕРАТОР:</label>
                  <select
                    id="soldier"
                    value={selectedSoldier}
                    onChange={(e) => setSelectedSoldier(e.target.value)}
                    required
                  >
                    <option value="">-- ВЫБЕРИТЕ ОПЕРАТОРА --</option>
                    {soldiers.map((soldier) => (
                      <option key={soldier.id} value={soldier.id}>
                        {`${soldier.name} ${soldier.surname || ""} ${soldier.lastname || ""}`.replace(/\s+/g, ' ').trim()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="action">ТИП ДЕЙСТВИЯ:</label>
                  <select
                    id="action"
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    required
                  >
                    <option value="">-- ВЫБЕРИТЕ ДЕЙСТВИЕ --</option>
                    {actions.map((action) => (
                      <option key={action.id} value={action.id}>
                        {action.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="status">СТАТУС ВЫПОЛНЕНИЯ:</label>
                  <select
                    id="status"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    required
                  >
                    <option value="">-- ВЫБЕРИТЕ СТАТУС --</option>
                    {actionStatuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="weapon">ИСПОЛЬЗОВАНО ОРУЖИЕ (ОПЦИОНАЛЬНО):</label>
                  <select
                    id="weapon"
                    value={selectedWeapon === null ? "" : selectedWeapon}
                    onChange={(e) => setSelectedWeapon(e.target.value ? parseInt(e.target.value, 10) : null)}
                  >
                    <option value="">-- НЕ УКАЗАНО --</option>
                    {weapons.map((weapon) => (
                      <option key={weapon.id} value={weapon.id}>
                        {weapon.name} [{weapon.typeName || 'N/A'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="special">СПЕЦСРЕДСТВА (ОПЦИОНАЛЬНО):</label>
                  <select
                    id="special"
                    value={selectedSpecial === null ? "" : selectedSpecial}
                    onChange={(e) => setSelectedSpecial(e.target.value ? parseInt(e.target.value, 10) : null)}
                  >
                    <option value="">-- НЕ УКАЗАНО --</option>
                    {specials.map((special) => (
                      <option key={special.id} value={special.id}>
                         {special.name} [{special.typeName || 'N/A'}]
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group form-group-full-width">
                  <label htmlFor="comment">КОММЕНТАРИЙ / РАПОРТ (ОПЦИОНАЛЬНО):</label>
                  <textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Детали операции, наблюдения, результаты..."
                    rows="4"
                  />
                </div>
              </div>
              
              {error && <p className="form-error-message"><FiAlertTriangle /> {error}</p>}

              <button type="submit" className="styled-button submit-action-button" disabled={loading || success}>
                {loading ? <FiLoader className="icon-spin" /> : <FiCheckCircle className="button-icon" />}
                {loading ? "РЕГИСТРАЦИЯ..." : "ЗАРЕГИСТРИРОВАТЬ ДЕЙСТВИЕ"}
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default MakeAction;