import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface Props {
  center: [number, number];
}

export default function MapView({ center }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      center,
      zoom: 8,
      style: import.meta.env.VITE_MAP_STYLE_URL // e.g. Amazon Location style descriptor URL
    });

    return () => {
      map.remove();
    };
  }, [center]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%', position: 'absolute' }}
    />
  );
}