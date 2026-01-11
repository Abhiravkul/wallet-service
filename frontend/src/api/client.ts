import axios from "axios";

export const apiClient = axios.create({
    baseURL: "http://localhost:3000",
    timeout: 5000,
    headers: {
        "Content-Type": "application/json",
    },
})


apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // backend returned an error payload
      return Promise.reject(error.response.data);
    }

    // network / timeout / CORS / server down
    return Promise.reject({
      error: "Network error",
    });
  }
);
