import React from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";

/*import { HOTEL_NAME } from "../config/constants";*/

const HomePage = () => {
  const navigate = useNavigate();

  const handleProceed = () => {
    navigate("/login", { replace: true });
  };

  /* ================= SHOOTING STARS ================= */
  const ShootingStars = () => {
    return (
      <div className="stars-container">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="shooting-star"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${2.5 + Math.random() * 3.5}s`,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&display=swap"
        rel="stylesheet"
      />

      <div className="home-container">
        {/* TOP LEFT LOGO */}
        <div className="top-left-brand">
          <div className="logo-orbit-wrapper">
            <img src="/images/DIMS-LOGO1.PNG" className="top-left-logo" />
            <span className="orbit-ring"></span>
            <span className="orbit-dot"></span>
          </div>
        </div>

        {/* ✅ MOVE THIS OUT */}
        <div className="hems-text">
          <span className="hems-letter">D</span>
          <span className="hems-letter">I</span>
          <span className="hems-letter">M</span>
          <span className="hems-letter">S</span>
        </div>



        {/* Background Animation */}
        <ShootingStars />

        {/* Main Content */}
        <div className="home-card">
          <div className="welcome-text">

            <h1 className="main-title">Welcome to DIMS</h1>

            <h2 className="main-heading">
              Distribution & Inventory Management System
            </h2>

            <p>
              <br />
              A complete Distribution & Inventory Management System for managing procurement, warehouses, inventory distribution, multiple locations, and operational consumption.
            </p>

          </div>

          <button
            className="proceed-button"
            onClick={handleProceed}
            type="button"
          >
            Proceed &gt;&gt;
          </button>
        </div>



        {/* Footer */}
        <footer className="home-footer">
          <div>
            Produced &amp; Licensed by School of Accounting Package © 2026
          </div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
