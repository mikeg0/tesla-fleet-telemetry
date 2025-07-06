import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { Vehicle } from '../types';
import { listVehicles, openVehicleStream } from '../api';

interface VehiclesState {
  loading: boolean;
  error?: string;
  vehicles: Vehicle[];
}

export function useVehicles(): VehiclesState {
  const { tokens } = useAuth();
  const [state, setState] = useState<VehiclesState>({ loading: true, vehicles: [] });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!tokens) return;

    // initial fetch
    listVehicles(tokens)
      .then((vehicles) => setState({ loading: false, vehicles }))
      .catch((err) => setState({ loading: false, vehicles: [], error: err.message }));

    // open stream
    const ws = openVehicleStream(tokens);
    wsRef.current = ws;

    if (ws) {
      ws.onmessage = (ev) => {
        try {
          const update: Partial<Vehicle> & { id: string } = JSON.parse(ev.data);
          setState((prev) => {
            const existing = prev.vehicles.find((v) => v.id === update.id);
            let vehicles: Vehicle[];
            if (existing) {
              vehicles = prev.vehicles.map((v) => (v.id === update.id ? { ...v, ...update } : v));
            } else {
              vehicles = [...prev.vehicles, update as Vehicle];
            }
            return { ...prev, vehicles };
          });
        } catch (e) {
          console.error('WS parse error', e);
        }
      };
      ws.onerror = (e) => {
        console.error('WS error', e);
        setState((prev) => ({ ...prev, error: 'WebSocket error' }));
      };
    }

    return () => {
      ws?.close();
    };
  }, [tokens]);

  return state;
}