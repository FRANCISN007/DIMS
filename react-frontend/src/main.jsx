import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import LicensePage from "./modules/license/LicensePage";
import LoginPage from "./modules/auth/LoginPage";
import RegisterPage from "./modules/auth/RegisterPage"; // if it exists

const App = () => {
  const [isLicenseVerified, setIsLicenseVerified] = useState(false);

  useEffect(() => {
    const licenseVerified = localStorage.getItem("license_verified") === "true";
    setIsLicenseVerified(licenseVerified);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/license" element={<LicensePage setIsLicenseVerified={setIsLicenseVerified} />} />
        <Route path="/login" element={isLicenseVerified ? <LoginPage /> : <Navigate to="/license" replace />} />
        <Route path="/register" element={isLicenseVerified ? <RegisterPage /> : <Navigate to="/license" replace />} />
        <Route path="/dashboard" element={isLicenseVerified ? <DashboardPage /> : <Navigate to="/license" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
