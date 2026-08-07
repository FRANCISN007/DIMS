// src/utils/licenseUtils.js
export function getLicenseExpiryWarning() {
  const expiry = localStorage.getItem("license_valid_until");
  if (!expiry) return null;

  const expiresOn = new Date(expiry);
  const now = new Date();

  const diffTime = expiresOn - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 30 && diffDays >= 0) {
    return `🔔 Your license will expire in ${diffDays} day${diffDays !== 1 ? "s" : ""}. Please renew it soon.`;
  }

  return null;
}
