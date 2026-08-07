import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListBar.css";


const ListBar = ({ onClose }) => {
  const axios = axiosWithAuth();
  const [bars, setBars] = useState([]);
  const [newBar, setNewBar] = useState({ name: "", location: "" });
  const [editId, setEditId] = useState(null);
  const [editBar, setEditBar] = useState({ name: "", location: "" });
  const [message, setMessage] = useState("");


  // ✅ Get user roles from localStorage
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  // ✅ Restrict access: only admin and bar can create payments
  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list bar</p>
      </div>
    );
  }


  useEffect(() => {
    fetchBars();
  }, []);

  useEffect(() => {
      if (message) {
        const timer = setTimeout(() => setMessage(""), 3000);
        return () => clearTimeout(timer); // cleanup if message changes or component unmounts
      }
    }, [message]);
    

  const fetchBars = async () => {
    const axios = axiosWithAuth();

    console.log("Axios Instance:", axios);
    console.log("Base URL:", axios.defaults.baseURL);

    try {
      const res = await axios.get("/bar/bars");

      console.log("Response URL:", res.request.responseURL);
      console.log("Content-Type:", res.headers["content-type"]);
      console.log("Authorization Header:", res.config.headers.Authorization);

      setBars(res.data);
    } catch (err) {
      console.log(err);
    }
  };


  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axiosWithAuth().post("/bar/bars", newBar);
      setNewBar({ name: "", location: "" });
      setMessage("✅ Bar created successfully!");
      fetchBars();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to create bar.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bar?")) return;
    try {
      await axiosWithAuth().delete(`/bar/bars/${id}`);
      setBars(bars.filter((bar) => bar.id !== id));
    } catch (err) {
      alert("❌ Failed to delete bar.");
    }
  };

  const handleUpdate = async (id) => {
    try {
      await axiosWithAuth().put(`/bar/bars/${id}`, editBar);
      setEditId(null);
      setEditBar({ name: "", location: "" });
      fetchBars();
    } catch (err) {
      alert("❌ Failed to update bar.");
    }
  };

  console.log("bars =", bars);
  console.log("typeof bars =", typeof bars);
  console.log("isArray =", Array.isArray(bars));

  return (
    <div className="bar-container">
      <div className="bar-header">
        <h2>🍷 Bar List</h2>
        {onClose && <button className="close-btn" onClick={onClose}>×</button>}
      </div>

      <form className="bar-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Bar Name"
          value={newBar.name}
          onChange={(e) => setNewBar({ ...newBar, name: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Location (optional)"
          value={newBar.location}
          onChange={(e) => setNewBar({ ...newBar, location: e.target.value })}
        />
        <button type="submit">➕ Add Bar</button>
      </form>

      <table className="bar-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Bar Name</th>
            <th>Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(bars) ? bars : []).map((bar, index) => (
            <tr key={bar.id} className={index % 2 === 0 ? "even-row" : "odd-row"}>
              <td>{bar.id}</td>
              <td>
                {editId === bar.id ? (
                  <input
                    value={editBar.name}
                    onChange={(e) => setEditBar({ ...editBar, name: e.target.value })}
                  />
                ) : (
                  bar.name
                )}
              </td>
              <td>
                {editId === bar.id ? (
                  <input
                    value={editBar.location || ""}
                    onChange={(e) => setEditBar({ ...editBar, location: e.target.value })}
                  />
                ) : (
                  bar.location || "—"
                )}
              </td>
              <td>
                {editId === bar.id ? (
                  <>
                    <button className="action-btn save" onClick={() => handleUpdate(bar.id)}>💾 Save</button>
                    <button className="action-btn cancel" onClick={() => setEditId(null)}>❌ Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      className="action-btn update"
                      onClick={() => {
                        setEditId(bar.id);
                        setEditBar({ name: bar.name, location: bar.location || "" });
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(bar.id)}>🗑️ Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message && <p className="bar-message">{message}</p>}
    </div>
  );
};

export default ListBar;
