import React from 'react';
import MapView from '../components/MapView';
import Spinner from '../components/Spinner';
import { useVehicles } from '../hooks/useVehicles';

export default function Home() {
  const { loading, error, vehicles } = useVehicles();

  const center: [number, number] = [-122.4194, 37.7749];

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {loading && <Spinner />}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <MapView center={center} vehicles={vehicles} />
      )}
    </div>
  );
}