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
  FiInfo
} from "react-icons/fi";
import "../css/SpecialDetailsPage.css";

// Axios client
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://217.71.129.139:5785',
  withCredentials: true,
});

// CSRF Interceptor
apiClient.interceptors.request.use(
  (config) => {
    const methodsRequiringCsrf = ["post", "put", "delete", "patch"];
    if (methodsRequiringCsrf.includes(config.method.toLowerCase())) {
      const csrfToken = localStorage.getItem("csrfToken");
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      } else {
        console.warn( // Dev-facing
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
  const [loading, setLoading] = useState(true);

  const fetchSpecial = useCallback(async () => {
    if (!id || isNaN(parseInt(id, 10)) || parseInt(id, 10) <= 0) {
        setError("Invalid or missing asset ID.");
        setLoading(false);
        setSpecial(null);
        return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/api/specials/${id}`);
      if (response.data && response.data.special) {
        setSpecial(response.data.special);
      } else {
        setSpecial(null);
        setError(`Asset with ID ${id} not found or data is incorrect.`);
      }
    } catch (err) {
      console.error("Ошибка при загрузке данных об объекте:", err); // Dev-facing
      if (err.response) {
        if (err.response.status === 404) {
          setError(`Asset with ID ${id} not found.`);
        } else if (err.response.status === 401 || err.response.status === 403) {
          setError("Authorization error. Please log in again.");
          // Optional: navigate("/login", { state: { message: "Session expired." } });
        } else {
          setError(`Failed to load data (Status: ${err.response.status}).`);
        }
      } else if (err.request) {
        setError("Server not responding. Check your internet connection.");
      } else {
        setError("An error occurred while preparing the request.");
      }
      setSpecial(null);
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
        <p>{"LOADING OPERATIONAL ASSET DATA..."}</p>
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
          {"Back to Assets List"}
        </Link>
      </div>
    );
  }

  if (!special) {
    return (
      <div className="status-container-special">
        <FiInfo size={48} />
        <p>{"Asset data not found or could not be loaded."}</p>
        <Link to="/specials" className="styled-button back-button-special">
          <FiArrowLeft className="button-icon" />
          {"Back to Assets List"}
        </Link>
      </div>
    );
  }

  return (
    <div className="special-details-page">
      <header className="special-details-header">
        <h1>
          <FiCpu className="header-icon" />
          {"// ASSET:"} {special.name || "UNNAMED"} {"//"}
        </h1>
        <Link to="/specials" className="styled-button back-button-header-special">
          <FiArrowLeft className="button-icon" />
          {"TO ASSETS LIST"}
        </Link>
      </header>

      <main className="special-details-content">
        <div className="special-card">
          <div className="special-card-header">
            <h2>{"ANALYTICAL REPORT FOR ASSET"} #{special.id || id}</h2>
          </div>
          <dl className="special-attributes">
            <div className="special-attribute special-attribute-full">
              <dt><FiFileText className="detail-icon" />{"DESCRIPTION / PURPOSE:"}</dt>
              <dd className="description-dd">{special.description || "MISSING"}</dd>
            </div>

            <div className="special-attribute">
              <dt><FiTag className="detail-icon" />{"CLASSIFICATION / TYPE:"}</dt>
              <dd>{special.type_name || special.typeName || "NOT SPECIFIED"}</dd>
            </div>

            <div className="special-attribute">
              <dt><FiActivity className="detail-icon" />{"CURRENT STATUS:"}</dt>
              <dd>
                <span className={`status-badge-special status-${getStatusClass(special.status_name || special.statusName)}`}>
                  {special.status_name || special.statusName || "UNDEFINED"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </main>

      <footer className="special-details-footer">
        <p>&copy; {new Date().getFullYear()} {"// SPECIAL ASSETS REGISTRY SYSTEM // ARCHIVE_SYGMA-7 //"}</p>
      </footer>
    </div>
  );
};

export default SpecialDetailsPage;