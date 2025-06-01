import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  // useNavigate, // Not strictly needed if using window.location for logout redirect
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
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  withCredentials: true,
});

// ... (getCsrfToken and apiClient.interceptors.request.use remain the same)
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

  // **Enhanced function to clear all auth-related data and state**
  const clearAuthDataAndSetState = useCallback(() => {
    console.log("App.js: Clearing all authentication data (authToken, csrfToken, user, etc.) and resetting state.");
    localStorage.removeItem('authToken');
    localStorage.removeItem('csrfToken'); // For fallback CSRF
    localStorage.removeItem('user'); // Important: Home.js uses this for display name
    localStorage.removeItem('isAuthenticated'); // Clear any old flags if they exist

    // Clear cookies related to session/CSRF if your server sets them and client needs to help clear (usually HttpOnly are server's job)
    // document.cookie = "csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"; // Example
    // document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"; // Example

    setIsAuthenticated(false);
    setAuthLoading(false); // We now know the auth state is definitively false
  }, []); // No dependencies needed as it uses localStorage and setIsAuthenticated


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
            // Store user data from /me endpoint if needed globally, or let components fetch their own.
            // localStorage.setItem('user', JSON.stringify(response.data.user)); // Optional
          } else {
            clearAuthDataAndSetState(); // Use the enhanced clear function
          }
        } catch (error) {
          if (error.response && error.response.status === 401) {
            console.log("App.js: Received 401 from /api/users/me, clearing auth data.");
          } else {
            console.error("App.js: Error verifying auth token with /api/users/me:", error.response?.data || error.message);
          }
          clearAuthDataAndSetState(); // Use the enhanced clear function on any error
        }
      } else {
        setIsAuthenticated(false); // No token, definitely not authenticated
      }
      setAuthLoading(false);
    };

    checkAuth();

    const handleStorageChange = (event) => {
        if (event.key === 'authToken' && localStorage.getItem('authToken') === null) {
            // Specifically listen for authToken removal (logout in another tab)
            console.log("App.js: authToken removed from localStorage (another tab). Finalizing logout.");
            clearAuthDataAndSetState(); // Ensure state is updated
            // Optionally, navigate to login if not already there, but clearAuthDataAndSetState should handle UI via isAuthenticated
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        } else if (event.key === 'authToken' && event.newValue !== null) {
            // Logged in on another tab
            console.log("App.js: authToken added/changed in localStorage (another tab). Re-checking auth.");
            setAuthLoading(true);
            checkAuth();
        }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loginTrigger, clearAuthDataAndSetState]); // Added clearAuthDataAndSetState to dependencies

  // **Master function to finalize logout, passed to child components**
  const finalizeLogout = useCallback(() => {
    console.log("App.js: Finalizing logout process.");
    clearAuthDataAndSetState(); // Clear all client data and update state

    // Force a hard navigation to the login page.
    // This ensures the entire React app re-initializes from a clean state.
    if (window.location.pathname !== "/") {
      window.location.href = "/";
    } else {
      // If already on /login (e.g., due to a race condition or manual navigation),
      // reload the page to ensure it's completely fresh.
      window.location.reload();
    }
  }, [clearAuthDataAndSetState]);


  const renderProtectedRoute = (Component, routeProps = {}) => {
    if (authLoading) {
      return <div>Проверка авторизации...</div>;
    }
    // Pass finalizeLogout to all protected components that might need it
    return isAuthenticated ? <Component {...routeProps} finalizeLogoutProcess={finalizeLogout} apiClient={apiClient} /> : <Navigate to="/login" replace />;
  };

  if (authLoading && isAuthenticated === null) {
    return <div>Загрузка приложения...</div>;
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
              <div>Проверка авторизации...</div>
            ) : isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        {/* Pass finalizeLogoutProcess to Home and other relevant pages */}
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
                <div>Проверка авторизации...</div>
            ) : isAuthenticated ? (
              <main style={{ padding: "1rem" }}><p>Страница не найдена (404)</p></main>
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