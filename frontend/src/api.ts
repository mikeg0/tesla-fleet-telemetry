import { AuthTokens } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const WS_URL = import.meta.env.VITE_WS_URL ?? '';

function authHeaders(tokens: AuthTokens | null): HeadersInit {
  if (!tokens) return {};
  return {
    Authorization: `Bearer ${tokens.idToken}`
  };
}

export async function listVehicles(tokens: AuthTokens | null) {
  const res = await fetch(`${API_BASE}/vehicles`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(tokens)
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch vehicles: ${res.status}`);
  return (await res.json()) as import('./types').Vehicle[];
}

export function openVehicleStream(tokens: AuthTokens | null): WebSocket | null {
  if (!WS_URL) return null;
  const url = `${WS_URL}?token=${tokens?.accessToken ?? ''}`;
  return new WebSocket(url);
}