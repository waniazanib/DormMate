import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface User {
  id: string;
  name: string;
  email: string;
  university: string;
  monthly_allowance: number;
  dorm_group_id: string | null;
  dorm_group?: {
    id: string;
    name: string;
    invite_code: string;
  }
}
