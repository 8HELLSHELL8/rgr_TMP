import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/LoginPage";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import WeaponsPage from "./pages/WeaponsPage";
import SpecialsPage from "./pages/SpecialsPage";
import WeaponDetailsPage from "./pages/WeaponDetailsPage";
import SpecialDetailsPage from "./pages/SpecialDetailsPage";
import LogDetail from "./pages/LogDetail";
import SaveLog from "./pages/SaveLog";
import MakeAction from "./pages/MakeAction";

import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://217.71.129.139:5785",
  withCredentials: true,
});

const getCsrfToken = () => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; csrf-token=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  const xsrfParts = value.split(`; XSRF-TOKEN=`);
  if (xsrfParts.length === 2) return xsrfParts.pop().split(';').shift();
  return null;
};

apiClient.interceptors.request.use(
  (config) => {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    const methodsRequiringCsrf = ['post', 'put', 'delete', 'patch'];
    if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
      const csrfTokenFromCookie = getCsrfToken();
      if (csrfTokenFromCookie) {
        config.headers['X-CSRF-Token'] = csrfTokenFromCookie;
      } else {
        const csrfTokenFromStorage = localStorage.getItem('csrfToken');
        if (csrfTokenFromStorage) {
            config.headers['X-CSRF-Token'] = csrfTokenFromStorage;
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginTrigger, setLoginTrigger] = useState(0);

  const clearAuthDataAndSetState = useCallback(() => {
    console.log("App.js: Clearing all authentication data (authToken, csrfToken, user, etc.) and resetting state.");
    localStorage.removeItem('authToken');
    localStorage.removeItem('csrfToken'); 
    localStorage.removeItem('user'); 
    localStorage.removeItem('isAuthenticated'); 

    setIsAuthenticated(false);
    setAuthLoading(false); 
  }, []); 


  const handleLoginSuccess = () => {
    setAuthLoading(true);
    setLoginTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        try {
          const response = await apiClient.get("/api/users/me");
          if (response.data.success && response.data.user) {
            setIsAuthenticated(true);
          } else {
            clearAuthDataAndSetState(); 
          }
        } catch (error) {
          if (error.response && error.response.status === 401) {
            console.log("App.js: Received 401 from /api/users/me, clearing auth data.");
          } else {
            console.error("App.js: Error verifying auth token with /api/users/me:", error.response?.data || error.message);
          }
          clearAuthDataAndSetState(); 
        }
      } else {
        setIsAuthenticated(false); 
      }
      setAuthLoading(false);
    };

    checkAuth();

    const handleStorageChange = (event) => {
        if (event.key === 'authToken' && localStorage.getItem('authToken') === null) {
            console.log("App.js: authToken removed from localStorage (another tab). Finalizing logout.");
            clearAuthDataAndSetState(); 
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        } else if (event.key === 'authToken' && event.newValue !== null) {
            console.log("App.js: authToken added/changed in localStorage (another tab). Re-checking auth.");
            setAuthLoading(true);
            checkAuth();
        }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loginTrigger, clearAuthDataAndSetState]); 

  const finalizeLogout = useCallback(() => {
    console.log("App.js: Finalizing logout process.");
    clearAuthDataAndSetState(); 

    if (window.location.pathname !== "/") {
      window.location.href = "/";
    } else {
      window.location.reload();
    }
  }, [clearAuthDataAndSetState]);


  const renderProtectedRoute = (Component, routeProps = {}) => {
    if (authLoading) {
      return <div>Checking authentication...</div>;
    }
    return isAuthenticated ? <Component {...routeProps} finalizeLogoutProcess={finalizeLogout} apiClient={apiClient} /> : <Navigate to="/login" replace />;
  };

  if (authLoading && isAuthenticated === null) {
    return <div>Loading app...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated && !authLoading ? (
              <Navigate to="/home" replace />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} />
            )
          }
        />
        <Route
          path="/"
          element={
            authLoading ? (
              <div>Checking authentication...</div>
            ) : isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/home" element={renderProtectedRoute(Home)} />
        <Route path="/profile" element={renderProtectedRoute(Profile)} />
        <Route path="/logs/full/:id" element={renderProtectedRoute(LogDetail)} />
        <Route path="/weapons" element={renderProtectedRoute(WeaponsPage)} />
        <Route path="/specials" element={renderProtectedRoute(SpecialsPage)} />
        <Route path="/weapons/:id" element={renderProtectedRoute(WeaponDetailsPage)} />
        <Route path="/specials/:id" element={renderProtectedRoute(SpecialDetailsPage)} />
        <Route path="/make-action" element={renderProtectedRoute(MakeAction)} />
        <Route path="/logs/download" element={renderProtectedRoute(SaveLog)} />
        <Route
          path="*"
          element={
            authLoading ? (
                <div>Checking authentication...</div>
            ) : isAuthenticated ? (
              <main style={{ padding: "1rem" }}><p>Page not found (404)</p></main>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;