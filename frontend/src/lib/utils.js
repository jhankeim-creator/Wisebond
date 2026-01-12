import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Centralized API URL - removes trailing slashes to prevent double slashes.
// IMPORTANT: If REACT_APP_BACKEND_URL isn't set in the frontend deployment environment,
// we fall back to the default Render backend URL to avoid accidentally calling `/api`
// on the frontend origin (Vercel).
const DEFAULT_BACKEND_URL = 'https://wisebond.onrender.com';
const ENV_BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').trim();
const RUNTIME_BACKEND_URL =
  (typeof window !== 'undefined' && window.__BACKEND_URL__ ? String(window.__BACKEND_URL__) : '').trim();

const BASE_URL = (ENV_BACKEND_URL || RUNTIME_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
export const API_BASE = `${BASE_URL}/api`;