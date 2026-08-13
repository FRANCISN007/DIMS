import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import getBaseUrl from "../../api/config";

import "./ListVendor.css";

const API_BASE_URL = getBaseUrl();

const ListVendor = () => {
  const [vendors, setVendors] = useState([]);

  const [formData, setFormData] = useState({
    business_name: "",
    address: "",
    phone_number: "",
  });

  const [message, setMessage] = useState("");

  // =========================================================
  // CURRENT USER
  //
  // IMPORTANT:
  // Do NOT use localStorage roles to block the page.
  //
  // The backend is responsible for checking:
  // admin / store / super_admin permissions.
  // =========================================================

  const storedUser =
    JSON.parse(localStorage.getItem("user")) || {};

  console.log("====================================");
  console.log("VENDOR PAGE USER");
  console.log("====================================");
  console.log("User:", storedUser);
  console.log("User roles:", storedUser.roles);
  console.log("Role name:", storedUser.role_name);
  console.log("Role code:", storedUser.role_code);
  console.log("====================================");

  // =========================================================
  // FETCH VENDORS
  // =========================================================

  useEffect(() => {
    fetchVendors();
  }, []);

  // =========================================================
  // MESSAGE AUTO CLEAR
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
  // FETCH VENDORS
  // =========================================================

  const fetchVendors = async () => {
    try {
      const axios = axiosWithAuth(API_BASE_URL);

      const response = await axios.get("/vendor/");

      console.log("VENDOR RESPONSE:", response.data);

      if (Array.isArray(response.data)) {
        setVendors(response.data);
      } else if (Array.isArray(response.data?.vendors)) {
        setVendors(response.data.vendors);
      } else {
        console.error(
          "Expected vendor array, got:",
          response.data
        );

        setVendors([]);
      }
    } catch (error) {
      console.error(
        "Error fetching vendors:",
        error
      );

      console.error(
        "Vendor error response:",
        error.response?.data
      );

      setVendors([]);

      setMessage(
        error.response?.data?.detail ||
          "❌ Failed to load vendors."
      );
    }
  };

  // =========================================================
  // DELETE VENDOR
  // =========================================================

  const handleDelete = async (vendorId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this vendor?"
      )
    ) {
      return;
    }

    try {
      const axios = axiosWithAuth(API_BASE_URL);

      await axios.delete(
        `/vendor/${vendorId}`
      );

      setMessage(
        "✅ Vendor deleted successfully."
      );

      fetchVendors();
    } catch (error) {
      console.error(
        "Error deleting vendor:",
        error
      );

      console.error(
        "Delete vendor response:",
        error.response?.data
      );

      setMessage(
        error.response?.data?.detail ||
          "❌ Failed to delete vendor."
      );
    }
  };

  // =========================================================
  // UPDATE VENDOR
  // =========================================================

  const handleUpdate = async (vendor) => {
    const newName = prompt(
      "Enter new business name",
      vendor.business_name
    );

    const newPhone = prompt(
      "Enter new phone number",
      vendor.phone_number
    );

    const newAddress = prompt(
      "Enter new address",
      vendor.address
    );

    if (
      !newName ||
      !newPhone ||
      !newAddress
    ) {
      setMessage(
        "❌ All fields are required."
      );

      return;
    }

    try {
      const axios = axiosWithAuth(API_BASE_URL);

      await axios.put(
        `/vendor/${vendor.id}`,
        {
          business_name: newName,
          phone_number: newPhone,
          address: newAddress,
        }
      );

      setMessage(
        "✅ Vendor updated successfully."
      );

      fetchVendors();
    } catch (error) {
      console.error(
        "Error updating vendor:",
        error
      );

      console.error(
        "Update vendor response:",
        error.response?.data
      );

      setMessage(
        error.response?.data?.detail ||
          "❌ Failed to update vendor."
      );
    }
  };

  // =========================================================
  // FORM HANDLERS
  // =========================================================

  const handleChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // =========================================================
  // CREATE VENDOR
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const axios = axiosWithAuth(API_BASE_URL);

      const response = await axios.post(
        "/vendor/",
        formData
      );

      console.log(
        "CREATE VENDOR RESPONSE:",
        response.data
      );

      setMessage(
        `✅ Vendor "${response.data.business_name}" created successfully.`
      );

      setFormData({
        business_name: "",
        address: "",
        phone_number: "",
      });

      fetchVendors();
    } catch (error) {
      console.error(
        "Error creating vendor:",
        error
      );

      console.error(
        "Create vendor response:",
        error.response?.data
      );

      const detail =
        error.response?.data?.detail;

      if (
        typeof detail === "string" &&
        detail.includes(
          "Vendor name already exists"
        )
      ) {
        setMessage(
          "❌ Vendor name already exists."
        );
      } else {
        setMessage(
          detail ||
            "❌ Failed to create vendor."
        );
      }
    }
  };

  // =========================================================
  // UI
  //
  // IMPORTANT:
  // No frontend Access Denied block here.
  //
  // The backend will decide whether the logged-in user
  // can access/create/update/delete vendors.
  // =========================================================

  return (
    <div className="vendor-container">

      <h2 className="vendor-heading">
        Vendor List
      </h2>

      {/* =====================================================
          CREATE VENDOR
      ===================================================== */}

      <form
        className="vendor-create-form"
        onSubmit={handleSubmit}
      >

        <input
          type="text"
          name="business_name"
          placeholder="Business Name"
          value={formData.business_name}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="address"
          placeholder="Address"
          value={formData.address}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="phone_number"
          placeholder="Phone Number"
          value={formData.phone_number}
          onChange={handleChange}
          required
        />

        <button type="submit">
          Add Vendor
        </button>

      </form>

      {/* =====================================================
          MESSAGE
      ===================================================== */}

      {message && (
        <p className="vendor-message">
          {message}
        </p>
      )}

      {/* =====================================================
          VENDOR TABLE
      ===================================================== */}

      <div className="vendor-table">

        <div className="vendor-table-header">

          <div>ID</div>

          <div>Business Name</div>

          <div>Phone</div>

          <div>Address</div>

          <div>Actions</div>

        </div>

        {vendors.length === 0 ? (

          <div className="vendor-table-row">

            <div colSpan="5">
              No vendors found.
            </div>

          </div>

        ) : (

          vendors.map((vendor) => (

            <div
              className="vendor-table-row"
              key={vendor.id}
            >

              <div>
                {vendor.id}
              </div>

              <div>
                {vendor.business_name}
              </div>

              <div>
                {vendor.phone_number}
              </div>

              <div>
                {vendor.address}
              </div>

              <div className="vendor-action-buttons">

                <button
                  className="vendor-btn vendor-btn-update"
                  onClick={() =>
                    handleUpdate(vendor)
                  }
                >
                  Update
                </button>

                <button
                  className="vendor-btn vendor-btn-delete"
                  onClick={() =>
                    handleDelete(vendor.id)
                  }
                >
                  Delete
                </button>

              </div>

            </div>

          ))

        )}

      </div>

    </div>
  );
};

export default ListVendor;