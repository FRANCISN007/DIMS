import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreatePurchase.css";

const CreatePurchase = () => {
  const axios = axiosWithAuth();

  /* =========================================================
     STATE
  ========================================================= */

  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [rows, setRows] = useState([
    {
      categoryId: "",
      itemId: "",
      itemName: "",
      quantity: "",
      unitPrice: "",
      total: 0,
      search: "",
      suggestions: [],
    },
  ]);

  const [vendorId, setVendorId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [message, setMessage] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const fetchTimeout = useRef(null);
  const searchCache = useRef({});

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    const initialize = async () => {
      setLoadingData(true);

      try {
        await Promise.all([
          fetchVendors(),
          fetchCategories(),
        ]);

        /*
         * Set today's date.
         */
        const today = new Date()
          .toISOString()
          .split("T")[0];

        setPurchaseDate(today);
      } finally {
        setLoadingData(false);
      }
    };

    initialize();

    return () => {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }
    };
  }, []);

  /* =========================================================
     MESSAGE AUTO CLEAR
  ========================================================= */

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  /* =========================================================
     FETCH VENDORS
  ========================================================= */

  const fetchVendors = async () => {
    try {
      const response = await axios.get("/vendor/");

      if (Array.isArray(response.data)) {
        setVendors(response.data);
      } else {
        setVendors([]);
      }

    } catch (error) {
      console.error(
        "Failed to fetch vendors:",
        error
      );

      console.error(
        "Vendor response:",
        error.response?.data
      );

      setVendors([]);

      const detail = error.response?.data?.detail;

      if (detail) {
        setMessage(`❌ ${detail}`);
      }
    }
  };

  /* =========================================================
     FETCH CATEGORIES
  ========================================================= */

  const fetchCategories = async () => {
    try {
      const response = await axios.get(
        "/store/categories"
      );

      if (Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }

    } catch (error) {
      console.error(
        "Failed to fetch categories:",
        error
      );

      console.error(
        "Category response:",
        error.response?.data
      );

      setCategories([]);

      const detail = error.response?.data?.detail;

      if (detail) {
        setMessage(`❌ ${detail}`);
      }
    }
  };

  /* =========================================================
     FETCH ITEMS
  ========================================================= */

  const fetchItems = async (searchText) => {
    const search = searchText.trim();

    if (!search) {
      return [];
    }

    if (searchCache.current[search]) {
      return searchCache.current[search];
    }

    try {
      const response = await axios.get(
        "/store/items/simple-search",
        {
          params: {
            search,
            limit: 20,
          },
        }
      );

      const data = Array.isArray(response.data)
        ? response.data
        : [];

      searchCache.current[search] = data;

      return data;

    } catch (error) {
      console.error(
        "Failed to search items:",
        error
      );

      console.error(
        "Item search response:",
        error.response?.data
      );

      return [];
    }
  };

  /* =========================================================
     UPDATE ROW TOTAL
  ========================================================= */

  const updateRowTotal = (row) => {
    const quantity =
      parseFloat(row.quantity) || 0;

    const unitPrice =
      parseFloat(row.unitPrice) || 0;

    row.total = quantity * unitPrice;
  };

  /* =========================================================
     SEARCH ITEM
  ========================================================= */

  const handleSearch = (index, value) => {
    setRows((previousRows) => {
      const updated = [...previousRows];

      if (!updated[index]) {
        return previousRows;
      }

      updated[index] = {
        ...updated[index],
        search: value,
        itemId: "",
        itemName: "",
        categoryId: "",
        suggestions: [],
      };

      return updated;
    });

    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
    }

    if (value.trim().length < 2) {
      return;
    }

    fetchTimeout.current = setTimeout(async () => {
      const results = await fetchItems(value);

      setRows((previousRows) => {
        const updated = [...previousRows];

        if (!updated[index]) {
          return previousRows;
        }

        updated[index] = {
          ...updated[index],
          suggestions: results,
        };

        return updated;
      });
    }, 300);
  };

  /* =========================================================
     ROW CHANGE
  ========================================================= */

  const handleRowChange = (
    index,
    field,
    value
  ) => {
    setRows((previousRows) => {
      const updated = [...previousRows];

      if (!updated[index]) {
        return previousRows;
      }

      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      updateRowTotal(updated[index]);

      return updated;
    });
  };

  /* =========================================================
     SELECT ITEM
  ========================================================= */

  const handleItemSelect = (
    index,
    item
  ) => {
    setRows((previousRows) => {
      const updated = [...previousRows];

      if (!updated[index]) {
        return previousRows;
      }

      const updatedRow = {
        ...updated[index],

        itemId: item.id,

        itemName: item.name,

        categoryId:
          item.category_id || "",

        unitPrice:
          item.unit_price || 0,

        search: item.name,

        suggestions: [],
      };

      updateRowTotal(updatedRow);

      updated[index] = updatedRow;

      return updated;
    });
  };

  /* =========================================================
     ADD ROW
  ========================================================= */

  const addRow = () => {
    setRows((previousRows) => [
      ...previousRows,

      {
        categoryId: "",
        itemId: "",
        itemName: "",
        quantity: "",
        unitPrice: "",
        total: 0,
        search: "",
        suggestions: [],
      },
    ]);
  };

  /* =========================================================
     REMOVE ROW
  ========================================================= */

  const removeRow = (index) => {
    setRows((previousRows) => {
      if (previousRows.length === 1) {
        return previousRows;
      }

      return previousRows.filter(
        (_, rowIndex) => rowIndex !== index
      );
    });
  };

  /* =========================================================
     SUBMIT PURCHASE
  ========================================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */

    if (!vendorId) {
      setMessage(
        "❌ Please select a vendor."
      );
      return;
    }

    if (!purchaseDate) {
      setMessage(
        "❌ Please select a purchase date."
      );
      return;
    }

    if (!invoiceNumber.trim()) {
      setMessage(
        "❌ Please enter the invoice number."
      );
      return;
    }

    const validRows = rows.filter(
      (row) =>
        row.itemId &&
        row.quantity &&
        row.unitPrice
    );

    if (validRows.length === 0) {
      setMessage(
        "❌ Please add at least one valid item."
      );
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      /* =====================================================
         CREATE EACH PURCHASE ENTRY
      ===================================================== */

      for (const row of validRows) {
        const formData = new FormData();

        formData.append(
          "item_id",
          String(row.itemId)
        );

        formData.append(
          "item_name",
          row.itemName
        );

        formData.append(
          "invoice_number",
          invoiceNumber.trim()
        );

        formData.append(
          "quantity",
          String(row.quantity)
        );

        formData.append(
          "unit_price",
          String(row.unitPrice)
        );

        formData.append(
          "vendor_id",
          String(vendorId)
        );

        formData.append(
          "purchase_date",
          purchaseDate
        );

        if (attachment) {
          formData.append(
            "attachment",
            attachment
          );
        }

        /*
         * IMPORTANT
         * ---------------------------------------------------
         * We do NOT send business_id.
         *
         * The backend determines the business from the
         * authenticated user:
         *
         * resolve_business_id(current_user, business_id)
         *
         * This keeps the frontend tenant-safe.
         */

        await axios.post(
          "/store/purchases",
          formData
        );
      }

      /* =====================================================
         SUCCESS
      ===================================================== */

      setMessage(
        "✅ Purchase saved successfully."
      );

      setRows([
        {
          categoryId: "",
          itemId: "",
          itemName: "",
          quantity: "",
          unitPrice: "",
          total: 0,
          search: "",
          suggestions: [],
        },
      ]);

      setVendorId("");
      setInvoiceNumber("");
      setAttachment(null);

      setPurchaseDate(
        new Date()
          .toISOString()
          .split("T")[0]
      );

      /*
       * Refresh supporting data.
       */
      await Promise.all([
        fetchVendors(),
        fetchCategories(),
      ]);

    } catch (error) {
      console.error(
        "===================================="
      );

      console.error(
        "CREATE PURCHASE ERROR"
      );

      console.error(
        "Status:",
        error.response?.status
      );

      console.error(
        "Response:",
        error.response?.data
      );

      console.error(
        "===================================="
      );

      const detail =
        error.response?.data?.detail;

      /*
       * Backend permission error.
       */
      if (
        error.response?.status === 401 ||
        error.response?.status === 403
      ) {
        setMessage(
          `❌ ${
            detail ||
            "You do not have permission to create a purchase."
          }`
        );
      } else {
        setMessage(
          detail ||
          "❌ Failed to save purchase."
        );
      }

    } finally {
      setIsSubmitting(false);
    }
  };

  /* =========================================================
     INVOICE TOTAL
  ========================================================= */

  const invoiceTotal = rows.reduce(
    (sum, row) =>
      sum +
      (parseFloat(row.total) || 0),
    0
  );

  /* =========================================================
     LOADING
  ========================================================= */

  if (loadingData) {
    return (
      <div className="create-purchase-container">
        <div className="loading-message">
          Loading purchase form...
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="create-purchase-container">

      <h2>
        Add New Purchase
      </h2>

      <form
        onSubmit={handleSubmit}
        className="purchase-form"
      >

        {/* =================================================
            PURCHASE HEADER
        ================================================= */}

        <div className="top-row">

          {/* VENDOR */}

          <div className="form-group">

            <label>
              Vendor
            </label>

            <select
              value={vendorId}
              onChange={(e) =>
                setVendorId(e.target.value)
              }
              required
            >

              <option value="">
                Select Vendor
              </option>

              {vendors.map((vendor) => (
                <option
                  key={vendor.id}
                  value={vendor.id}
                >
                  {vendor.business_name ||
                    vendor.name}
                </option>
              ))}

            </select>

          </div>

          {/* PURCHASE DATE */}

          <div className="form-group">

            <label>
              Purchase Date
            </label>

            <input
              type="date"
              value={purchaseDate}
              onChange={(e) =>
                setPurchaseDate(
                  e.target.value
                )
              }
              required
            />

          </div>

          {/* INVOICE NUMBER */}

          <div className="form-group">

            <label>
              Invoice Number
            </label>

            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) =>
                setInvoiceNumber(
                  e.target.value
                )
              }
              placeholder="Enter invoice number"
              required
            />

          </div>

        </div>

        {/* =================================================
            ATTACHMENT
        ================================================= */}

        <div className="attachment-row">

          <div className="form-group full-width">

            <label>
              Attach Invoice (optional)
            </label>

            <input
              type="file"
              onChange={(e) =>
                setAttachment(
                  e.target.files?.[0] || null
                )
              }
            />

          </div>

        </div>

        {/* =================================================
            PURCHASE ITEMS
        ================================================= */}

        <div className="purchase-items-table">

          <div className="table-header">

            <span>
              Quantity
            </span>

            <span>
              Item
            </span>

            <span>
              Category
            </span>

            <span>
              Unit Price
            </span>

            <span>
              Total
            </span>

            <span>
              Action
            </span>

          </div>

          {rows.map((row, index) => (

            <div
              className="table-row"
              key={index}
            >

              {/* QUANTITY */}

              <input
                type="number"
                min="1"
                step="1"
                value={row.quantity}
                onChange={(e) =>
                  handleRowChange(
                    index,
                    "quantity",
                    e.target.value
                  )
                }
                required
              />

              {/* ITEM SEARCH */}

              <div className="autocomplete">

                <input
                  type="text"
                  placeholder="Type item name..."
                  value={row.search}
                  onChange={(e) =>
                    handleSearch(
                      index,
                      e.target.value
                    )
                  }
                  required
                />

                {row.suggestions.length > 0 && (

                  <ul className="suggestions-list">

                    {row.suggestions.map(
                      (item) => (

                        <li
                          key={item.id}
                          onClick={() =>
                            handleItemSelect(
                              index,
                              item
                            )
                          }
                        >
                          {item.name}
                        </li>

                      )
                    )}

                  </ul>

                )}

              </div>

              {/* CATEGORY */}

              <select
                value={row.categoryId}
                disabled
              >

                <option value="">
                  Select Category
                </option>

                {categories.map(
                  (category) => (

                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>

                  )
                )}

              </select>

              {/* UNIT PRICE */}

              <input
                type="number"
                min="0"
                step="0.01"
                value={row.unitPrice}
                onChange={(e) =>
                  handleRowChange(
                    index,
                    "unitPrice",
                    e.target.value
                  )
                }
                required
              />

              {/* TOTAL */}

              <input
                type="number"
                className="total-cell"
                value={row.total}
                readOnly
              />

              {/* REMOVE */}

              <button
                type="button"
                className="remove-btn"
                onClick={() =>
                  removeRow(index)
                }
                disabled={
                  isSubmitting ||
                  rows.length === 1
                }
              >
                Remove
              </button>

            </div>

          ))}

        </div>

        {/* =================================================
            ADD ITEM
        ================================================= */}

        <button
          type="button"
          className="add-row-btn"
          onClick={addRow}
          disabled={isSubmitting}
        >
          + Add Item
        </button>

        {/* =================================================
            TOTAL
        ================================================= */}

        <div className="invoice-total">

          <strong>
            Total:
          </strong>{" "}

          {invoiceTotal.toLocaleString(
            "en-NG",
            {
              style: "currency",
              currency: "NGN",
            }
          )}

        </div>

        {/* =================================================
            SUBMIT
        ================================================= */}

        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Saving Purchase..."
            : "Add Purchase"}
        </button>

        {/* =================================================
            MESSAGE
        ================================================= */}

        {message && (
          <p className="message">
            {message}
          </p>
        )}

      </form>

    </div>
  );
};

export default CreatePurchase;