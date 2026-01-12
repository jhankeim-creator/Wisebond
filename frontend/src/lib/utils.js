import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Centralized API URL - removes trailing slashes to prevent double slashes
const BASE_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
export const API_BASE = `${BASE_URL}/api`;