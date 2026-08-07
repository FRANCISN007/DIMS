import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const loginUser = async (username, password) => {
  const res = await axios.post(
    `${BASE_URL}/users/token`,
    new URLSearchParams({ username, password }), // fix encoding
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  const token = res.data.access_token;
  localStorage.setItem("token", token);

  // 🔽 Decode JWT to extract user role
  try {
    const base64Payload = token.split(".")[1];
    const payload = JSON.parse(atob(base64Payload));
    const role = payload?.role?.toLowerCase();
    localStorage.setItem("role", role); // store the role for later
  } catch (e) {
    console.warn("Failed to decode JWT for role:", e);
  }

  return token;
};

export const getUserRoleFromToken = (token) => {
  if (!token) return null;

  try {
    const base64Payload = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(base64Payload));
    return decodedPayload?.role?.toLowerCase() || null;
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
};
