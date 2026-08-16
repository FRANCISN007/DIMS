import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListItem.css";

const ListItem = () => {
  const [items, setItems] = useState([]);
  const [simpleItems, setSimpleItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =========================================================
  // EDITING STATES
  // =========================================================

  const [editingItem, setEditingItem] = useState(null);

  const [updateName, setUpdateName] = useState("");
  const [updateUnit, setUpdateUnit] = useState("");
  const [updateUnitPrice, setUpdateUnitPrice] = useState("");
  const [updateSellingPrice, setUpdateSellingPrice] = useState("");
  const [updateCategoryId, setUpdateCategoryId] = useState("");
  const [updateItemType, setUpdateItemType] = useState("");

  const [selectedSimpleItemId, setSelectedSimpleItemId] = useState("");

  // =========================================================
  // CREATION STATES
  // =========================================================

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newSellingPrice, setNewSellingPrice] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newItemType, setNewItemType] = useState("");

  // =========================================================
  // SEARCH
  // =========================================================

  const [searchText, setSearchText] = useState("");

  // =========================================================
  // OPTIONS
  // =========================================================

  const unitOptions = [
    "Carton",
    "Kg",
    "Basket",
    "crates",
    "Piece",
  ];

  const itemTypeOptions = [
    "All",
    "ingredients",
    "food stuff",
    "protein",
    "general",
  ];

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    fetchItems();
    fetchSimpleItems();
    fetchCategories();
  }, []);

  // =========================================================
  // AUTO CLEAR MESSAGE
  // =========================================================

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  // =========================================================
  // SAFE ERROR MESSAGE
  // =========================================================

  const safeMessage = (
    err,
    fallback = "❌ Operation failed."
  ) => {
    const detail = err?.response?.data?.detail;

    if (!detail) {
      return fallback;
    }

    if (typeof detail === "string") {
      return detail;
    }

    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  };

  // =========================================================
  // FETCH ITEMS
  // =========================================================

  const fetchItems = async (search = "") => {
    try {
      setLoading(true);

      const res = await axiosWithAuth().get(
        "/store/items",
        {
          params: {
            search,
          },
        }
      );

      setItems(
        Array.isArray(res.data)
          ? res.data
          : []
      );

    } catch (err) {
      console.error(
        "❌ Failed to load items:",
        err?.response?.data || err
      );

      setItems([]);

      setMessage(
        safeMessage(
          err,
          "❌ Failed to load items."
        )
      );

    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // FETCH SIMPLE ITEMS
  // =========================================================

  const fetchSimpleItems = async (search = "") => {
    try {
      const res = await axiosWithAuth().get(
        "/store/items/simple-search",
        {
          params: {
            search,
          },
        }
      );

      setSimpleItems(
        Array.isArray(res.data)
          ? res.data
          : []
      );

    } catch (err) {
      console.error(
        "❌ Failed to load simple items:",
        err?.response?.data || err
      );

      setSimpleItems([]);
    }
  };

  // =========================================================
  // FETCH CATEGORIES
  // =========================================================

  const fetchCategories = async () => {
    try {
      const res = await axiosWithAuth().get(
        "/store/categories"
      );

      setCategories(
        Array.isArray(res.data)
          ? res.data
          : []
      );

    } catch (err) {
      console.error(
        "❌ Failed to load categories:",
        err?.response?.data || err
      );

      setCategories([]);

      setMessage(
        safeMessage(
          err,
          "❌ Failed to load categories."
        )
      );
    }
  };

  // =========================================================
  // SEARCH
  // =========================================================

  const handleSearchChange = (e) => {
    const value = e.target.value;

    setSearchText(value);

    fetchItems(value);
    fetchSimpleItems(value);
  };

  // =========================================================
  // DELETE ITEM
  // =========================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this item?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await axiosWithAuth().delete(
        `/store/items/${id}`
      );

      setItems((prev) =>
        prev.filter(
          (item) => item.id !== id
        )
      );

      await fetchSimpleItems(searchText);

      setMessage(
        "✅ Item deleted successfully."
      );

    } catch (err) {
      console.error(
        "❌ Failed to delete item:",
        err?.response?.data || err
      );

      setMessage(
        safeMessage(
          err,
          "❌ Failed to delete item."
        )
      );
    }
  };

  // =========================================================
  // OPEN EDIT MODAL
  // =========================================================

  const openEditModal = (item) => {
    setEditingItem(item);

    setUpdateName(
      item.name || ""
    );

    setUpdateUnit(
      item.unit || ""
    );

    setUpdateUnitPrice(
      item.unit_price ?? ""
    );

    setUpdateSellingPrice(
      item.selling_price ?? ""
    );

    setUpdateCategoryId(
      item.category?.id
        ? String(item.category.id)
        : ""
    );

    setUpdateItemType(
      item.item_type || "All"
    );

    setSelectedSimpleItemId(
      String(item.id)
    );
  };

  // =========================================================
  // SIMPLE ITEM CHANGE
  // =========================================================

  const handleSimpleItemChange = (value) => {
    setSelectedSimpleItemId(value);

    const selected = simpleItems.find(
      (item) =>
        String(item.id) === String(value)
    );

    if (!selected) {
      return;
    }

    setEditingItem(selected);

    setUpdateName(
      selected.name || ""
    );

    setUpdateUnit(
      selected.unit || ""
    );

    setUpdateUnitPrice(
      selected.unit_price ?? ""
    );

    setUpdateSellingPrice(
      selected.selling_price ?? ""
    );

    setUpdateCategoryId(
      selected.category?.id
        ? String(selected.category.id)
        : ""
    );

    setUpdateItemType(
      selected.item_type || "All"
    );
  };

  // =========================================================
  // UPDATE ITEM
  // =========================================================

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    // ---------------------------------------------
    // Validate basic fields
    // ---------------------------------------------

    if (!updateName.trim()) {
      setMessage(
        "❌ Item name is required."
      );
      return;
    }

    if (!updateUnit.trim()) {
      setMessage(
        "❌ Unit is required."
      );
      return;
    }

    const unitPrice = parseFloat(
      updateUnitPrice
    );

    if (isNaN(unitPrice)) {
      setMessage(
        "❌ Unit price must be a valid number."
      );
      return;
    }

    // ---------------------------------------------
    // Selling price is OPTIONAL
    // ---------------------------------------------

    let sellingPrice = null;

    if (
      updateSellingPrice !== null &&
      updateSellingPrice !== undefined &&
      String(updateSellingPrice).trim() !== ""
    ) {
      sellingPrice = parseFloat(
        updateSellingPrice
      );

      if (isNaN(sellingPrice)) {
        setMessage(
          "❌ Selling price must be a valid number."
        );
        return;
      }
    }

    // ---------------------------------------------
    // Category
    // ---------------------------------------------

    const parsedCategoryId =
      parseInt(updateCategoryId, 10);

    if (isNaN(parsedCategoryId)) {
      setMessage(
        "❌ Please select a valid category."
      );
      return;
    }

    // ---------------------------------------------
    // Submit
    // ---------------------------------------------

    setIsSubmitting(true);

    try {
      const payload = {
        name: updateName.trim(),
        unit: updateUnit.trim(),
        unit_price: unitPrice,
        selling_price: sellingPrice,
        category_id: parsedCategoryId,
        item_type: updateItemType || "All",
      };

      console.log(
        "Updating item:",
        payload
      );

      await axiosWithAuth().put(
        `/store/items/${editingItem.id}`,
        payload
      );

      setMessage(
        "✅ Item updated successfully."
      );

      setEditingItem(null);

      // Refresh independently.
      await fetchItems(searchText);
      await fetchSimpleItems(searchText);

    } catch (err) {
      console.error(
        "❌ Failed to update item:",
        err?.response?.data || err
      );

      setMessage(
        safeMessage(
          err,
          "❌ Failed to update item."
        )
      );

    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // CREATE ITEM
  // =========================================================

  const handleCreate = async (e) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    // ---------------------------------------------
    // Validate name
    // ---------------------------------------------

    if (!newName.trim()) {
      setMessage(
        "❌ Item name is required."
      );
      return;
    }

    // ---------------------------------------------
    // Validate unit
    // ---------------------------------------------

    if (!newUnit.trim()) {
      setMessage(
        "❌ Unit is required."
      );
      return;
    }

    // ---------------------------------------------
    // Validate unit price
    // ---------------------------------------------

    let unitPrice = null;

    if (
      newUnitPrice !== null &&
      newUnitPrice !== undefined &&
      String(newUnitPrice).trim() !== ""
    ) {
      unitPrice = parseFloat(
        newUnitPrice
      );

      if (isNaN(unitPrice)) {
        setMessage(
          "❌ Unit price must be a valid number."
        );
        return;
      }
    }

    // ---------------------------------------------
    // Selling price is OPTIONAL
    // ---------------------------------------------

    let sellingPrice = null;

    if (
      newSellingPrice !== null &&
      newSellingPrice !== undefined &&
      String(newSellingPrice).trim() !== ""
    ) {
      sellingPrice = parseFloat(
        newSellingPrice
      );

      if (isNaN(sellingPrice)) {
        setMessage(
          "❌ Selling price must be a valid number."
        );
        return;
      }
    }

    // ---------------------------------------------
    // Validate category
    // ---------------------------------------------

    const parsedCategoryId =
      parseInt(newCategoryId, 10);

    if (isNaN(parsedCategoryId)) {
      setMessage(
        "❌ Please select a valid category."
      );
      return;
    }

    // ---------------------------------------------
    // Build payload
    // ---------------------------------------------

    const payload = {
      name: newName.trim(),
      unit: newUnit.trim(),
      unit_price: unitPrice,

      // null is intentionally sent when
      // selling price is not provided.
      selling_price: sellingPrice,

      category_id: parsedCategoryId,
      item_type: newItemType || "All",
    };

    console.log(
      "================================"
    );

    console.log(
      "CREATE ITEM PAYLOAD:",
      payload
    );

    console.log(
      "================================"
    );

    setIsSubmitting(true);

    try {
      // =====================================================
      // IMPORTANT:
      // Only this request determines whether creation failed.
      // =====================================================

      const response =
        await axiosWithAuth().post(
          "/store/items",
          payload
        );

      console.log(
        "CREATE ITEM RESPONSE:",
        response.status,
        response.data
      );

      // =====================================================
      // SUCCESS
      // =====================================================

      setMessage(
        "✅ Item created successfully."
      );

      // Clear form
      setNewName("");
      setNewUnit("");
      setNewUnitPrice("");
      setNewSellingPrice("");
      setNewCategoryId("");
      setNewItemType("");

      // =====================================================
      // Refresh list separately.
      //
      // If refresh fails, it must NOT change the
      // successful create message.
      // =====================================================

      fetchItems(searchText).catch(
        (refreshError) => {
          console.error(
            "Item created, but item list refresh failed:",
            refreshError
          );
        }
      );

      fetchSimpleItems(searchText).catch(
        (refreshError) => {
          console.error(
            "Item created, but simple item refresh failed:",
            refreshError
          );
        }
      );

    } catch (err) {
      // =====================================================
      // THIS IS ONLY A CREATE REQUEST ERROR
      // =====================================================

      console.error(
        "❌ CREATE ITEM REQUEST FAILED:",
        err?.response?.status,
        err?.response?.data || err
      );

      setMessage(
        safeMessage(
          err,
          "❌ Failed to create item."
        )
      );

    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="list-item-container">

      <h2>📋 Item List</h2>

      {message && (
        <p className="list-item-message">
          {message}
        </p>
      )}

      {/* =====================================================
          SEARCH
      ===================================================== */}

      <input
        type="text"
        placeholder="🔍 Search items..."
        value={searchText}
        onChange={handleSearchChange}
        className="search-input"
      />

      {/* =====================================================
          CREATE ITEM
      ===================================================== */}

      <h3>➕ Create New Item</h3>

      <form
        onSubmit={handleCreate}
        className="create-item-form"
      >

        {/* NAME */}

        <label>
          Name:

          <input
            type="text"
            value={newName}
            onChange={(e) =>
              setNewName(e.target.value)
            }
            placeholder="e.g. Food Stuff, Protein"
            required
          />
        </label>

        {/* UNIT */}

        <label>
          Unit:

          <select
            value={newUnit}
            onChange={(e) =>
              setNewUnit(e.target.value)
            }
            required
          >
            <option value="">
              Select Unit
            </option>

            {unitOptions.map((unit) => (
              <option
                key={unit}
                value={unit}
              >
                {unit}
              </option>
            ))}
          </select>
        </label>

        {/* UNIT PRICE */}

        <label>
          Unit Price:

          <input
            type="number"
            step="1"
            min="0"
            value={newUnitPrice}
            onChange={(e) =>
              setNewUnitPrice(
                e.target.value
              )
            }
            placeholder="Optional"
            
          />
        </label>

        {/* SELLING PRICE */}

        <label>
          Selling Price:

          <input
            type="number"
            step="1"
            min="0"
            value={newSellingPrice}
            onChange={(e) =>
              setNewSellingPrice(
                e.target.value
              )
            }
            placeholder="Optional"
          />
        </label>

        {/* CATEGORY */}

        <label>
          Category:

          <select
            value={newCategoryId}
            onChange={(e) =>
              setNewCategoryId(
                e.target.value
              )
            }
            required
          >
            <option value="">
              Select Category
            </option>

            {categories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {/* ITEM TYPE */}

        <label>
          Item Type:

          <select
            value={newItemType}
            onChange={(e) =>
              setNewItemType(
                e.target.value
              )
            }
          >
            {itemTypeOptions.map((type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            ))}
          </select>
        </label>

        {/* CREATE BUTTON */}

        <button
          type="submit"
          className="save-btn"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Saving..."
            : "➕ Add Item"}
        </button>

      </form>

      <hr />

      {/* =====================================================
          ITEM TABLE
      ===================================================== */}

      {loading ? (
        <p>Loading items...</p>

      ) : items.length === 0 ? (

        <p>No items found.</p>

      ) : (

        <div className="scrollable-table-container">

          <table className="item-table">

            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Unit</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Category</th>
                <th>Item Type</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {items.map((item, index) => (

                <tr
                  key={item.id}
                  className={
                    index % 2 === 0
                      ? "even-row"
                      : "odd-row"
                  }
                >

                  <td>
                    {item.id}
                  </td>

                  <td>
                    {item.name}
                  </td>

                  <td>
                    {item.unit}
                  </td>

                  <td>
                    {item.unit_price}
                  </td>

                  <td>
                    {item.selling_price !== null &&
                    item.selling_price !== undefined &&
                    item.selling_price !== ""
                      ? item.selling_price
                      : "—"}
                  </td>

                  <td>
                    {item.category?.name || "—"}
                  </td>

                  <td>
                    {item.item_type || "All"}
                  </td>

                  <td>

                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() =>
                        openEditModal(item)
                      }
                    >
                      ✏️ Edit
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() =>
                        handleDelete(item.id)
                      }
                    >
                      🗑 Delete
                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>
      )}

      {/* =====================================================
          EDIT MODAL
      ===================================================== */}

      {editingItem && (

        <div className="modal-backdrop">

          <div className="modal-content">

            <h3>
              ✏️ Update Item
            </h3>

            {/* SEARCH ITEM */}

            <label>
              Search & Select Item:

              <input
                type="text"
                placeholder="🔍 Search item in catalog..."
                onChange={(e) =>
                  fetchSimpleItems(
                    e.target.value
                  )
                }
                className="search-input"
              />

              <select
                value={selectedSimpleItemId}
                onChange={(e) =>
                  handleSimpleItemChange(
                    e.target.value
                  )
                }
              >
                <option value="">
                  -- Select Item --
                </option>

                {simpleItems.map((item) => (

                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name} ({item.unit}) -
                    {" "}₦{item.unit_price}
                    {" / "}
                    ₦
                    {item.selling_price ??
                      "—"}
                    {" - "}
                    {item.item_type ||
                      "All"}
                  </option>

                ))}

              </select>
            </label>

            <form onSubmit={handleUpdate}>

              {/* NAME */}

              <label>
                Name:

                <input
                  type="text"
                  value={updateName}
                  onChange={(e) =>
                    setUpdateName(
                      e.target.value
                    )
                  }
                  required
                />
              </label>

              {/* UNIT */}

              <label>
                Unit:

                <select
                  value={updateUnit}
                  onChange={(e) =>
                    setUpdateUnit(
                      e.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select Unit
                  </option>

                  {unitOptions.map((unit) => (
                    <option
                      key={unit}
                      value={unit}
                    >
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              {/* UNIT PRICE */}

              <label>
                Unit Cost Price:

                <input
                  type="number"
                  step="1"
                  min="0"
                  value={updateUnitPrice}
                  onChange={(e) =>
                    setUpdateUnitPrice(
                      e.target.value
                    )
                  }
                  
                />
              </label>

              {/* SELLING PRICE */}

              <label>
                Selling Price:

                <input
                  type="number"
                  step="1"
                  min="0"
                  value={updateSellingPrice}
                  onChange={(e) =>
                    setUpdateSellingPrice(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              {/* CATEGORY */}

              <label>
                Category:

                <select
                  value={updateCategoryId}
                  onChange={(e) =>
                    setUpdateCategoryId(
                      e.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select Category
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* ITEM TYPE */}

              <label>
                Item Type:

                <select
                  value={updateItemType}
                  onChange={(e) =>
                    setUpdateItemType(
                      e.target.value
                    )
                  }
                >
                  {itemTypeOptions.map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              {/* BUTTONS */}

              <div className="modal-buttons">

                <button
                  type="submit"
                  className="save-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : "💾 Save"}
                </button>

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() =>
                    setEditingItem(null)
                  }
                >
                  ❌ Cancel
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
};

export default ListItem;