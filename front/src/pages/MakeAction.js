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
  baseURL: process.env.REACT_APP_API_URL || "http://217.71.129.139:5785",
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
      console.error(`Error fetching ${url}:`, err);
      throw err; // Re-throw to be caught by the caller
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
          let errorMessage = "Error loading necessary data.";
          if (err.response && err.response.status === 401) {
            errorMessage = "Authorization error. Please log in again.";
            navigate('/login');
          } else if (err.message) {
            // Use the error message from the re-thrown error in fetchGenericData
            errorMessage = `Failed to load data: ${err.message.toLowerCase().includes('network error') ? 'Network error or server unavailable.' : err.message}`;
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
      setError("Required fields: OPERATOR, ACTION, STATUS - must be filled.");
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
        setError(response.data?.message || "Failed to create record. Check the data.");
      }
    } catch (err) {
      console.error("Error creating record:", err);
      let specificError = "An error occurred. Failed to create record.";
      if (err.response) {
        if (err.response.status === 401) {
          specificError = "Authorization error. Your session may have expired.";
          navigate('/login');
        } else if (err.response.status === 403) {
           specificError = err.response.data?.message || "CSRF token error or insufficient permissions.";
        } else if (err.response.status === 400 && err.response.data && err.response.data.errors) {
            const validationErrors = Object.values(err.response.data.errors).join(', ');
            specificError = `Validation error: ${validationErrors}`;
        } else if (err.response.status === 500) {
          specificError = "Internal server error. Try again later.";
        } else if (err.response.data && err.response.data.message) {
           specificError = err.response.data.message;
        }
      } else if (err.request) {
        specificError = "Server not responding. Check your connection.";
      }
      setError(specificError);
      setSuccess(false);
    } finally {
        if (!success) setLoading(false); // Only set loading to false if not successful (success has its own loader)
    }
  };

  const goBack = () => navigate(-1);

  if (loading && !success) { // Show main loader only if not in success state
    return (
      <div className="status-container">
        <FiLoader className="icon-spin" size={48} />
        <p>LOADING FORM DATA...</p>
      </div>
    );
  }

  // Error display if essential data failed to load
  if (error && !soldiers.length && !actions.length && !actionStatuses.length && !loading) {
    return (
      <div className="status-container error-display">
        <FiAlertTriangle size={48} />
        <p className="error-message">{error}</p>
        <button onClick={goBack} className="styled-button button-secondary">
          <FiArrowLeftCircle className="button-icon"/> BACK
        </button>
      </div>
    );
  }


  return (
    <div className="make-action-page">
      <div className="page-container">
        <header className="page-header">
          <h1>{"// OPERATIONAL LOG: REGISTER ACTION //"}</h1>
          <button className="styled-button button-secondary back-button" onClick={goBack}>
            <FiArrowLeftCircle className="button-icon" />
            CANCEL
          </button>
        </header>

        <main className="make-action-main card-style">
          {success && (
            <div className="status-container success-display">
              <FiCheckCircle size={60} />
              <p>RECORD SUCCESSFULLY REGISTERED!</p>
              <p className="redirect-info">Redirecting...</p>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="action-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="soldier">OPERATOR:</label>
                  <select
                    id="soldier"
                    value={selectedSoldier}
                    onChange={(e) => setSelectedSoldier(e.target.value)}
                    required
                  >
                    <option value="">-- SELECT OPERATOR --</option>
                    {soldiers.map((soldier) => (
                      <option key={soldier.id} value={soldier.id}>
                        {`${soldier.name} ${soldier.surname || ""} ${soldier.lastname || ""}`.replace(/\s+/g, ' ').trim()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="action">ACTION TYPE:</label>
                  <select
                    id="action"
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    required
                  >
                    <option value="">-- SELECT ACTION --</option>
                    {actions.map((action) => (
                      <option key={action.id} value={action.id}>
                        {action.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="status">EXECUTION STATUS:</label>
                  <select
                    id="status"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    required
                  >
                    <option value="">-- SELECT STATUS --</option>
                    {actionStatuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="weapon">WEAPON USED (OPTIONAL):</label>
                  <select
                    id="weapon"
                    value={selectedWeapon === null ? "" : selectedWeapon}
                    onChange={(e) => setSelectedWeapon(e.target.value ? parseInt(e.target.value, 10) : null)}
                  >
                    <option value="">-- NOT SPECIFIED --</option>
                    {weapons.map((weapon) => (
                      <option key={weapon.id} value={weapon.id}>
                        {weapon.name} [{weapon.typeName || 'N/A'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="special">SPECIAL EQUIPMENT (OPTIONAL):</label>
                  <select
                    id="special"
                    value={selectedSpecial === null ? "" : selectedSpecial}
                    onChange={(e) => setSelectedSpecial(e.target.value ? parseInt(e.target.value, 10) : null)}
                  >
                    <option value="">-- NOT SPECIFIED --</option>
                    {specials.map((special) => (
                      <option key={special.id} value={special.id}>
                         {special.name} [{special.typeName || 'N/A'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group form-group-full-width">
                  <label htmlFor="comment">COMMENT / REPORT (OPTIONAL):</label>
                  <textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Operation details, observations, results..."
                    rows="4"
                  />
                </div>
              </div>

              {error && !success && <p className="form-error-message"><FiAlertTriangle /> {error}</p>}

              <button type="submit" className="styled-button submit-action-button" disabled={loading || success}>
                {loading && !success ? <FiLoader className="icon-spin" /> : <FiCheckCircle className="button-icon" />}
                {loading && !success ? "REGISTERING..." : "REGISTER ACTION"}
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default MakeAction;