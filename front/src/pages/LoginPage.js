import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiLogIn, FiX, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import '../css/LoginPage.css';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

const LoginPage = ({ onLoginSuccess }) => { // <-- Деструктурируем onLoginSuccess из props
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // apiClient для LoginPage.js можно оставить как есть, т.к. для /api/login
  // обычно не нужен Authorization header и CSRF может обрабатываться иначе.
  // Если же /api/login требует CSRF из куки, то лучше использовать общий apiClient из App.js
  const localApiClient = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
    withCredentials: true,
  });


  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!username || !password) {
      setError('Пожалуйста, введите логин и пароль.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await localApiClient.post('/api/login', { // Используем localApiClient
        username,
        password,
      });

      const { success, message, user, token, csrfToken } = response.data;

      if (success) {
        localStorage.setItem('authToken', token);
        // csrfToken из ответа логина сохраняется. Интерсептор в App.js попытается сначала взять из куки,
        // потом может использовать этот из localStorage как fallback.
        if (csrfToken) {
            localStorage.setItem('csrfToken', csrfToken);
        }
        
        setUsername('');
        setPassword('');
        setError('');

        // console.log('LoginPage: Авторизация успешна:', { user, token, csrfToken });

        if (onLoginSuccess) {
          onLoginSuccess(); // <-- ВЫЗЫВАЕМ КОЛБЭК ПЕРЕД НАВИГАЦИЕЙ
        }

        navigate('/home');
      } else {
        setError(message || 'Произошла ошибка при входе.');
      }
    } catch (err) {
      // console.error("LoginPage: Ошибка при входе:", err);
      
      localStorage.removeItem('csrfToken'); // Удаляем, если была ошибка с CSRF
      
      if (err.response) {
        if (err.response.status === 401) {
          setError("Неверный логин или пароль.");
        } else if (err.response.status === 403) {
          setError("Ошибка доступа или CSRF-токена. Попробуйте обновить страницу.");
        } else if (err.response.status >= 500) {
          setError("Ошибка на сервере. Повторите попытку позже.");
        } else {
          setError(err.response.data?.message || `Ошибка: ${err.response.status}`);
        }
      } else if (err.request) {
        setError("Сервер не отвечает. Проверьте интернет-соединение.");
      } else {
        setError("Ошибка при подготовке запроса.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-form-container"> 
        <header className="login-header">
          <h1>{"// СИСТЕМА АУТЕНТИФИКАЦИИ //"}</h1>
          <p>{"ТРЕБУЕТСЯ ВВОД УЧЕТНЫХ ДАННЫХ ОПЕРАТОРА"}</p>
        </header>

        {error && (
          <div className="error-message-banner" role="alert">
            <FiAlertTriangle className="error-icon" />
            <span className="error-text">{error}</span>
            <button 
              onClick={() => setError('')} 
              aria-label="Закрыть сообщение об ошибке"
              className="close-error-button"
            >
              <FiX />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-main">
          <div className="form-group">
            <label htmlFor="username">ПОЗЫВНОЙ / LOGIN</label>
            <div className="input-group">
              <FiUser className="input-icon" />
              <input
                id="username"
                type="text"
                placeholder="Введите ваш позывной..."
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                aria-describedby={error && username === '' ? "error-text-id" : undefined} 
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">СЕКРЕТНЫЙ КОД / PASSWORD</label>
            <div className="input-group">
              <FiLock className="input-icon" />
              <input
                id="password"
                type="password"
                placeholder="Введите ваш код доступа..."
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                aria-describedby={error && password === '' ? "error-text-id" : undefined} 
              />
            </div>
          </div>

          <button type="submit" className="submit-login-button" disabled={loading}>
            {loading ? (
              <>
                <FiLoader className="button-icon icon-spin" />
                АУТЕНТИФИКАЦИЯ...
              </>
            ) : (
              <>
                <FiLogIn className="button-icon" />
                ВОЙТИ В СИСТЕМУ
              </>
            )}
          </button>
        </form>
      </div>
      <div className="login-art-display">
        <div className="art-overlay-text">
            <p>{"STRICTLY RESTRICTED ACCESS"}</p>
            <p>{"UNAUTHORIZED ENTRY PROHIBITED"}</p>
            <p>{"// SECURE CHANNEL //"}</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;