import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiLogIn, FiX, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import '../css/LoginPage.css';

// apiClient can be configured globally or used locally depending on CSRF handling for login.
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://217.71.129.139:5785',
  withCredentials: true,
});

const LoginPage = ({ onLoginSuccess }) => { // Destructure onLoginSuccess from props
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // localApiClient for LoginPage.js can remain as is, as /api/login
  // usually doesn't need an Authorization header, and CSRF might be handled differently.
  // If /api/login requires CSRF from a cookie, it's better to use a shared apiClient (e.g., from App.js).
  const localApiClient = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://217.71.129.139:5785',
    withCredentials: true,
  });


  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!username || !password) {
      setError('Please enter username and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await localApiClient.post('/api/login', { // Using localApiClient
        username,
        password,
      });

      const { success, message, user, token, csrfToken } = response.data;

      if (success) {
        localStorage.setItem('authToken', token);
        // csrfToken from login response is saved.
        // An interceptor (e.g., in App.js) might first try to get it from a cookie,
        // then could use this from localStorage as a fallback.
        if (csrfToken) {
            localStorage.setItem('csrfToken', csrfToken);
        }

        setUsername('');
        setPassword('');
        setError('');

        // console.log('LoginPage: Authentication successful:', { user, token, csrfToken });

        if (onLoginSuccess) {
          onLoginSuccess(); // CALL CALLBACK BEFORE NAVIGATION
        }

        navigate('/home');
      } else {
        setError(message || 'An error occurred during login.');
      }
    } catch (err) {
      // console.error("LoginPage: Login error:", err);

      localStorage.removeItem('csrfToken'); // Remove if there was a CSRF error

      if (err.response) {
        if (err.response.status === 401) {
          setError("Invalid username or password.");
        } else if (err.response.status === 403) {
          setError("Access error or CSRF token issue. Try refreshing the page.");
        } else if (err.response.status >= 500) {
          setError("Server error. Please try again later.");
        } else {
          setError(err.response.data?.message || `Error: ${err.response.status}`);
        }
      } else if (err.request) {
        setError("Server not responding. Check your internet connection.");
      } else {
        setError("Error preparing the request.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-form-container">
        <header className="login-header">
          <h1>{"// AUTHENTICATION SYSTEM //"}</h1>
          <p>{"OPERATOR CREDENTIALS REQUIRED"}</p>
        </header>

        {error && (
          <div className="error-message-banner" role="alert">
            <FiAlertTriangle className="error-icon" />
            <span className="error-text">{error}</span>
            <button
              onClick={() => setError('')}
              aria-label="Close error message"
              className="close-error-button"
            >
              <FiX />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-main">
          <div className="form-group">
            <label htmlFor="username">CALLSIGN / LOGIN</label>
            <div className="input-group">
              <FiUser className="input-icon" />
              <input
                id="username"
                type="text"
                placeholder="Enter your callsign..."
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
            <label htmlFor="password">SECRET CODE / PASSWORD</label>
            <div className="input-group">
              <FiLock className="input-icon" />
              <input
                id="password"
                type="password"
                placeholder="Enter your access code..."
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
                AUTHENTICATING...
              </>
            ) : (
              <>
                <FiLogIn className="button-icon" />
                LOG IN TO SYSTEM
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