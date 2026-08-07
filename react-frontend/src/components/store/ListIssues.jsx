import React, { useState, useEffect, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListIssues.css";

const ListIssues = () => {
  const [issues, setIssues] = useState([]);
  const [bars, setBars] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedBarId, setSelectedBarId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingIssue, setEditingIssue] = useState(null);
  const [formData, setFormData] = useState({
    issue_to: "bar",
    issued_to_id: "",
    issue_date: "",
    issue_items: [],
  });
  const [originalIssueCounts, setOriginalIssueCounts] = useState({});
  const fetchTimeout = useRef(null);

  const getToday = () => new Date().toISOString().split("T")[0];

  useEffect(() => {
    const { firstDay, lastDay } = (() => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      return { firstDay: first, lastDay: last };
    })();
    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];
  if (Array.isArray(storedUser.roles)) roles = storedUser.roles;
  else if (typeof storedUser.role === "string") roles = [storedUser.role];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list items issued.</p>
      </div>
    );
  }

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  };

  // =============================
  // SEARCH STORE ITEMS
  // =============================
  const fetchItems = async (searchText) => {
    if (!searchText.trim()) return [];

    try {
        const res = await axiosWithAuth().get(
            "/store/items/simple-search",
            {
                params: {
                    search: searchText,
                    limit: 20,
                },
            }
        );

        return res.data || [];

    } catch (err) {
        console.error("Item search failed:", err);
        return [];
    }
};

  // fetch bars and items once
  useEffect(() => {
    (async () => {
      try {
        const [barsRes, itemsRes] = await Promise.all([
          axiosWithAuth().get("/bar/bars/simple"),
          axiosWithAuth().get("/store/items/simple"),
        ]);
        setBars(Array.isArray(barsRes.data) ? barsRes.data : []);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
      } catch (err) {
        console.error("Error fetching bars/items", err);
      }
    })();
  }, []);

  const fetchIssues = async (
    barId = selectedBarId,
    sDate = startDate,
    eDate = endDate
  ) => {
    try {
      const params = {};
      if (barId) params.bar_id = barId;
      if (sDate) params.start_date = sDate;
      if (eDate) params.end_date = eDate;

      const res = await axiosWithAuth().get("/store/bar", { params });
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching issues", err);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [selectedBarId, startDate, endDate]);

  const handleEditClick = (issue) => {
    const issue_items = (issue.issue_items || []).map((it) => ({
      itemId: it.item?.id || "",
      itemName: it.item?.name || "",
      search: it.item?.name || "",
      suggestions: [],
      quantity: it.quantity || "",
    }));

    const orig = {};

    issue_items.forEach((it) => {
      const id = Number(it.itemId);

      if (!id) return;

      orig[id] = (orig[id] || 0) + Number(it.quantity || 0);
    });

    setOriginalIssueCounts(orig);

    setFormData({
      issue_to: "bar",
      issued_to_id: issue.issued_to_id || "",
      issue_date: issue.issue_date
        ? issue.issue_date.split("T")[0]
        : getToday(),
      issue_items,
    });

    setEditingIssue(issue.id);
  };

  const handleFormChange = (index, field, value) => {
    setFormData(prev => {

        const updated = [...prev.issue_items];

        if(field==="search"){
            updated[index].search=value;
            updated[index].itemId="";
            updated[index].itemName="";
        }

        if(field==="quantity"){
            updated[index].quantity=value;
        }

        if(field==="select_item"){
            updated[index].itemId=value.id;
            updated[index].itemName=value.name;
            updated[index].search=value.name;
            updated[index].suggestions=[];
        }

        return {
            ...prev,
            issue_items:updated
        };

    });

    if(field==="search"){

        if(fetchTimeout.current)
            clearTimeout(fetchTimeout.current);

        fetchTimeout.current=setTimeout(async()=>{

            const results=await fetchItems(value);

            setFormData(prev=>{

                const rows=[...prev.issue_items];

                rows[index].suggestions=results;

                return{
                    ...prev,
                    issue_items:rows
                };

            });

        },300);

    }
};
  const addIssueLine = () => {
    setFormData({
      ...formData,
      issue_items: [
        ...formData.issue_items,
        {
          itemId: "",
          itemName: "",
          search: "",
          suggestions: [],
          quantity: "",
        },
      ],
    });
  };

  const removeIssueLine = (index) => {
    const newItems = [...formData.issue_items];
    newItems.splice(index, 1);
    setFormData({ ...formData, issue_items: newItems });
  };

  const handleSubmitEdit = async (id) => {
    try {
      if (!formData.issued_to_id) {
        showMessage("❌ Please select a bar.");
        return;
      }

      if (!formData.issue_items.length) {
        showMessage("❌ Add at least one item.");
        return;
      }

      const requested = {};

      for (const row of formData.issue_items) {
        const itemId = Number(row.itemId || 0);
        const qty = Number(row.quantity || 0);

        if (!itemId) {
          showMessage("❌ Select an item for every row.");
          return;
        }

        if (qty <= 0) {
          showMessage("❌ Quantity must be greater than zero.");
          return;
        }

        requested[itemId] = (requested[itemId] || 0) + qty;
      }

      // Validate stock

      for (const itemId of Object.keys(requested)) {
        const reqQty = requested[itemId];

        const stockRes = await axiosWithAuth().get(
          `/store/stock/${itemId}`
        );

        const available = Number(stockRes.data?.available || 0);

        const oldQty = Number(
          originalIssueCounts[itemId] || 0
        );

        const allowed = available + oldQty;

        if (reqQty > allowed) {
          const item =
            items.find((i) => i.id === Number(itemId)) || {};

          showMessage(
            `❌ ${item.name} only has ${allowed} available.`
          );

          return;
        }
      }

      const payload = {
        issue_to: "bar",
        issued_to_id: Number(formData.issued_to_id),
        issue_date: formData.issue_date,

        issue_items: formData.issue_items.map((row) => ({
          item_id: Number(row.itemId),
          quantity: Number(row.quantity),
        })),
      };

      await axiosWithAuth().put(
        `/store/bar-issues/${id}`,
        payload
      );

      showMessage("✅ Issue updated successfully.");

      setEditingIssue(null);

      setOriginalIssueCounts({});

      fetchIssues();
    } catch (err) {
      console.error(err);

      showMessage(
        err.response?.data?.detail ||
          "❌ Failed to update issue."
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this issue?")) return;
    try {
      await axiosWithAuth().delete(`/store/bar-issues/${id}`);
      showMessage("✅ Issue deleted successfully.");
      fetchIssues();
    } catch (err) {
      console.error("Delete failed", err);
      showMessage("❌ Failed to delete issue.");
    }
  };

  const totalIssued = issues.length;
  const totalQuantity = issues.reduce((acc, issue) => 
    acc + (issue.issue_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0), 0);

  return (
    <div className="list-issues-container">
      <h2>📦 List of Issued Items to Bar</h2>

      <div className="filters">
        <select
          value={selectedBarId}
          onChange={(e) => setSelectedBarId(e.target.value)}
        >
          <option value="">-- All Bars --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>

        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <button
          onClick={() => {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
            setSelectedBarId("");
            setStartDate(first);
            setEndDate(last);
          }}
        >
          ♻️ Reset
        </button>
      </div>

      {message && <p className="issue-message">{message}</p>}

      <div className="summary">
        <p>Total Entries: {totalIssued}</p>
        <p>Total Quantity Issued: {totalQuantity}</p>
      </div>

      {/* Vertical Scroll Table */}
      <div className="table-scroll-container">
        <table className="list-issues-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Issue To</th>
              <th>Issue Date</th>
              <th>Items Issued</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 ? (
              <tr><td colSpan="5">No issues found.</td></tr>
            ) : issues.map((issue) => (
              <tr key={issue.id}>
                <td>{issue.id}</td>
                <td>{issue.issued_to?.name || "Unnamed Bar"}</td>
                <td>{new Date(issue.issue_date).toLocaleDateString()}</td>
                <td>
                  <ul style={{ paddingLeft: "1rem", margin: 0 }}>
                    {issue.issue_items.map(it => (
                      <li key={it.id}>
                        {it.item?.name || 'Item'} — Qty: {it.quantity}
                      </li>
                    ))}
                  </ul>
                </td>
                <td>
                  <button className="edit-btn" onClick={() => handleEditClick(issue)}>✏️ Edit</button>
                  <button className="delete-btn" onClick={() => handleDelete(issue.id)}>🗑️ Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingIssue && (
        <div className="bar-edit-modal-overlay">
          <div className="bar-edit-form">
            <h3>Edit Issue</h3>

            <label>Bar:</label>
            <select value={formData.issued_to_id} onChange={(e) => setFormData({ ...formData, issued_to_id: e.target.value })}>
              <option value="">-- Select a bar --</option>
              {bars.map(bar => <option key={bar.id} value={bar.id}>{bar.name}</option>)}
            </select>

            <label>Issue Date:</label>
            <input type="date" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} />

            <h4>Items</h4>

            <div className="bar-items-scroll">

              {(formData.issue_items || []).map((row, index) => (

                  <div className="bar-item-row" key={index}>

                      <div className="bar-autocomplete">

                          <input
                              type="text"
                              placeholder="Search item..."
                              value={row.search}
                              onChange={(e)=>
                                  handleFormChange(
                                      index,
                                      "search",
                                      e.target.value
                                  )
                              }
                          />

                          {row.suggestions.length > 0 && (

                              <ul className="bar-suggestions-list">

                                  {row.suggestions.map((item) => (
                                    <li
                                        key={item.id}
                                        onClick={() =>
                                            handleFormChange(index, "select_item", item)
                                        }
                                    >
                                        {item.name}
                                    </li>
                                ))}

                              </ul>

                          )}

                      </div>

                      <input
                          type="number"
                          min="1"
                          step="1"
                          value={row.quantity}
                          onChange={(e)=>
                              handleFormChange(
                                  index,
                                  "quantity",
                                  e.target.value
                              )
                          }
                      />

                      <button
                          type="button"
                          className=" bar-remove-line"
                          onClick={() =>
                              removeIssueLine(index)
                          }
                      >

                          ❌

                      </button>

                  </div>

              ))}

          </div>

            <button type="button" className="bar-add-btn" onClick={addIssueLine}>➕ Add Item</button>

            <div className="bar-modal-actions">
              <button className="bar-save-btn" onClick={() => handleSubmitEdit(editingIssue)}>✅ Save</button>
              <button className="bar-cancel-btn" onClick={() => setEditingIssue(null)}>❌ Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListIssues;