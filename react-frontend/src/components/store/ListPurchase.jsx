import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListPurchase.css";

const ListPurchase = () => {
  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [vendorId, setVendorId] = useState("");
  const [itemId, setItemId] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [totalEntries, setTotalEntries] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  const [editingPurchase, setEditingPurchase] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);

  const axios = axiosWithAuth();

  // =========================
  // ✅ Load TODAY data on mount
  //
  // IMPORTANT:
  // No frontend role check.
  //
  // Backend handles:
  //
  // role_required([
  //     "store",
  //     "procurement",
  //     "admin",
  //     "super_admin"
  // ])
  // =========================
  useEffect(() => {
    const today = new Date()
      .toISOString()
      .split("T")[0];

    setStartDate(today);
    setEndDate(today);

    fetchPurchases(
      today,
      today
    );
  }, []);

  // =========================
  // ✅ Load Items & Vendors
  // =========================
  useEffect(() => {
    const loadItemsAndVendors = async () => {
      try {
        const resItems = await axios.get(
          "/store/items/simple"
        );

        setItems(
          Array.isArray(resItems.data)
            ? resItems.data
            : []
        );

        const resVendors = await axios.get(
          "/vendor/"
        );

        const vendorData =
          Array.isArray(resVendors.data)
            ? resVendors.data
            : resVendors.data?.vendors || [];

        setVendors(vendorData);

      } catch (err) {
        console.error(
          "❌ Error fetching items/vendors",
          err
        );

        /*
          If the backend returns a permission error,
          show the backend message instead of assuming
          the frontend user has no role.
        */

        if (err.response?.data?.detail) {
          setError(
            typeof err.response.data.detail === "string"
              ? err.response.data.detail
              : "❌ Failed to load items/vendors."
          );
        }
      }
    };

    loadItemsAndVendors();
  }, []);

  // =========================
  // ✅ Clear message after 3 seconds
  // =========================
  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  // =========================
  // ✅ Fetch Purchases
  // =========================
  const fetchPurchases = async (
    start = startDate,
    end = endDate,
    vendor = vendorId,
    item = itemId,
    invoice = invoiceNumber
  ) => {
    setLoading(true);
    setError("");

    try {
      const params = {};

      // =========================
      // DATE
      // =========================

      if (start) {
        params.start_date = start;
      }

      if (end) {
        params.end_date = end;
      }

      // =========================
      // VENDOR
      // =========================

      if (vendor) {
        params.vendor_id = Number(vendor);
      }

      // =========================
      // ITEM
      // =========================

      if (item) {
        params.item_id = Number(item);
      }

      // =========================
      // INVOICE
      // =========================

      if (invoice && invoice.trim()) {
        params.invoice_number =
          invoice.trim();
      }

      // =====================================================
      // IMPORTANT
      //
      // DO NOT SEND business_id.
      //
      // Backend now resolves the business from the
      // logged-in user's tenant context.
      //
      // effective_business_id =
      //     resolve_business_id(
      //         current_user,
      //         business_id
      //     )
      // =====================================================

      console.log(
        "Fetching purchases:",
        params
      );

      const res = await axios.get(
        "/store/purchases",
        {
          params,
        }
      );

      console.log(
        "Purchase response:",
        res.data
      );

      // =========================
      // PURCHASES
      // =========================

      setPurchases(
        Array.isArray(res.data?.purchases)
          ? res.data.purchases
          : []
      );

      // =========================
      // TOTAL ENTRIES
      // =========================

      setTotalEntries(
        Number(
          res.data?.total_entries || 0
        )
      );

      // =========================
      // TOTAL AMOUNT
      // =========================

      setTotalAmount(
        Number(
          res.data?.total_amount || 0
        )
      );

    } catch (err) {
      console.error(
        "❌ Failed to fetch purchases:",
        err
      );

      console.error(
        "Purchase response:",
        err.response?.data
      );

      setPurchases([]);
      setTotalEntries(0);
      setTotalAmount(0);

      // =========================
      // BACKEND ERROR
      // =========================

      if (err.response?.status === 401) {
        setError(
          "❌ Your session has expired. Please login again."
        );
      } else if (err.response?.status === 403) {
        setError(
          "🚫 You do not have permission to list purchase."
        );
      } else if (
        err.response?.data?.detail
      ) {
        setError(
          typeof err.response.data.detail === "string"
            ? err.response.data.detail
            : "❌ Failed to fetch purchases."
        );
      } else {
        setError(
          "❌ Failed to fetch purchases"
        );
      }

    } finally {
      setLoading(false);
    }
  };

  // =========================
  // ✅ Delete
  // =========================
  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this purchase?"
      )
    ) {
      return;
    }

    try {
      await axios.delete(
        `/store/purchases/${id}`
      );

      setMessage(
        "✅ Purchase deleted successfully."
      );

      fetchPurchases();

    } catch (err) {
      console.error(
        "Delete purchase error:",
        err
      );

      setMessage(
        err.response?.data?.detail ||
          "❌ Failed to delete purchase."
      );
    }
  };

  // =========================
  // ✅ Edit
  // =========================
  const handleEditClick = (purchase) => {
    setEditingPurchase({
      ...purchase,

      purchase_date:
        purchase.purchase_date
          ? new Date(
              purchase.purchase_date
            )
              .toISOString()
              .slice(0, 16)
          : "",
    });

    setAttachmentFile(null);
  };

  // =========================
  // ✅ Edit Change
  // =========================
  const handleEditChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    setEditingPurchase(
      (prev) => ({
        ...prev,
        [name]: value,
      })
    );
  };

  // =========================
  // ✅ Edit Submit
  // =========================
  const handleEditSubmit = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();

      formData.append(
        "item_id",
        editingPurchase.item_id
      );

      formData.append(
        "item_name",
        editingPurchase.item_name || ""
      );

      formData.append(
        "invoice_number",
        editingPurchase.invoice_number || ""
      );

      formData.append(
        "quantity",
        editingPurchase.quantity
      );

      formData.append(
        "unit_price",
        editingPurchase.unit_price
      );

      formData.append(
        "vendor_id",
        editingPurchase.vendor_id
      );

      formData.append(
        "purchase_date",
        new Date(
          editingPurchase.purchase_date
        ).toISOString()
      );

      if (attachmentFile) {
        formData.append(
          "attachment",
          attachmentFile
        );
      }

      await axios.put(
        `/store/purchases/${editingPurchase.id}`,
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

      setMessage(
        "✅ Purchase updated successfully."
      );

      setEditingPurchase(null);
      setAttachmentFile(null);

      fetchPurchases();

    } catch (err) {
      console.error(
        "Update purchase error:",
        err
      );

      setMessage(
        err.response?.data?.detail ||
          "❌ Failed to update purchase."
      );
    }
  };

  // =========================
  // UI
  // =========================

  return (
    <div className="list-purchase-container">

      <h2>
        List Purchases
      </h2>

      {message && (
        <p className="message">
          {message}
        </p>
      )}

      {/* =========================
          Filters
      ========================= */}

      <div className="filters">

        <input
          type="date"
          value={startDate}
          onChange={(e) =>
            setStartDate(
              e.target.value
            )
          }
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) =>
            setEndDate(
              e.target.value
            )
          }
        />

        <input
          type="text"
          value={invoiceNumber}
          onChange={(e) =>
            setInvoiceNumber(
              e.target.value
            )
          }
          placeholder="Invoice number"
        />

        <select
          value={itemId}
          onChange={(e) =>
            setItemId(
              e.target.value
            )
          }
        >

          <option value="">
            All Items
          </option>

          {items.map((i) => (
            <option
              key={i.id}
              value={i.id}
            >
              {i.name}
            </option>
          ))}

        </select>

        <select
          value={vendorId}
          onChange={(e) =>
            setVendorId(
              e.target.value
            )
          }
        >

          <option value="">
            All Vendors
          </option>

          {vendors.map((v) => (
            <option
              key={v.id}
              value={v.id}
            >
              {v.business_name ||
                v.name}
            </option>
          ))}

        </select>

        <button
          onClick={() =>
            fetchPurchases()
          }
          disabled={loading}
        >
          {loading
            ? "Loading..."
            : "Search"}
        </button>

      </div>

      {/* =========================
          Summary
      ========================= */}

      <div className="summary">

        <p>
          <strong>
            Total Entries:
          </strong>{" "}
          {totalEntries}
        </p>

        <p>
          <strong>
            Total Purchase:
          </strong>{" "}
          ₦
          {Number(
            totalAmount || 0
          ).toLocaleString()}
        </p>

      </div>

      {/* =========================
          Table with Vertical Scroll
      ========================= */}

      {loading ? (

        <p>
          Loading...
        </p>

      ) : error ? (

        <p className="error">
          {error}
        </p>

      ) : (

        <div className="table-scroll-container">

          <table className="purchase-table">

            <thead>

              <tr>

                <th>
                  Invoice
                </th>

                <th>
                  Item
                </th>

                <th>
                  Qty
                </th>

                <th>
                  Unit Price
                </th>

                <th>
                  Total
                </th>

                <th>
                  Vendor
                </th>

                <th>
                  Date
                </th>

                <th>
                  Created By
                </th>

                <th>
                  Attachment
                </th>

                <th>
                  Action
                </th>

              </tr>

            </thead>

            <tbody>

              {purchases.length === 0 ? (

                <tr>

                  <td colSpan="10">
                    No data
                  </td>

                </tr>

              ) : (

                purchases.map((p) => (

                  <tr key={p.id}>

                    <td>
                      {p.invoice_number}
                    </td>

                    <td>
                      {p.item_name}
                    </td>

                    <td>
                      {p.quantity}
                    </td>

                    <td>
                      {p.unit_price}
                    </td>

                    <td>
                      {p.total_amount}
                    </td>

                    <td>
                      {p.vendor_name}
                    </td>

                    <td>
                      {p.purchase_date
                        ? new Date(
                            p.purchase_date
                          ).toLocaleDateString()
                        : "-"}
                    </td>

                    <td>
                      {p.created_by}
                    </td>

                    <td>

                      {p.attachment_url ? (

                        <a
                          href={
                            p.attachment_url
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>

                      ) : (

                        "-"
                      )}

                    </td>

                    <td>

                      <button
                        onClick={() =>
                          handleEditClick(p)
                        }
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          handleDelete(p.id)
                        }
                      >
                        Delete
                      </button>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      )}

      {/* =========================
          Edit Modal
      ========================= */}

      {editingPurchase && (

        <div
          className="edit-modal-overlay"
          onClick={() =>
            setEditingPurchase(null)
          }
        >

          <form
            className="edit-form"
            onClick={(e) =>
              e.stopPropagation()
            }
            onSubmit={
              handleEditSubmit
            }
          >

            <h3>
              Edit Purchase
            </h3>

            <input
              name="invoice_number"
              value={
                editingPurchase.invoice_number ||
                ""
              }
              onChange={
                handleEditChange
              }
            />

            <input
              name="quantity"
              type="number"
              value={
                editingPurchase.quantity ||
                ""
              }
              onChange={
                handleEditChange
              }
            />

            <input
              name="unit_price"
              type="number"
              value={
                editingPurchase.unit_price ||
                ""
              }
              onChange={
                handleEditChange
              }
            />

            <input
              type="datetime-local"
              name="purchase_date"
              value={
                editingPurchase.purchase_date ||
                ""
              }
              onChange={
                handleEditChange
              }
            />

            <input
              type="file"
              onChange={(e) =>
                setAttachmentFile(
                  e.target.files?.[0] ||
                    null
                )
              }
            />

            <button type="submit">
              Update
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingPurchase(null);
                setAttachmentFile(null);
              }}
            >
              Cancel
            </button>

          </form>

        </div>

      )}

    </div>
  );
};

export default ListPurchase;