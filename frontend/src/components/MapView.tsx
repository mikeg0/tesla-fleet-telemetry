import React, { useEffect, useRef } from 'react';
import maplibregl, { Popup } from 'maplibre-gl';
import { Vehicle } from '../types';

interface Props {
  center: [number, number];
  vehicles: Vehicle[];
}

export default function MapView({ center, vehicles }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      center,
      zoom: 8,
      style: import.meta.env.VITE_MAP_STYLE_URL // Amazon Location style descriptor URL
    });

    // add nav controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapInstanceRef.current = map;

    return () => {
      // cleanup markers and map
      markersRef.current.forEach((m) => m.remove());
      map.remove();
    };
  }, [center]);

  // update markers when vehicles prop changes
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapInstanceRef.current;
    if (!map) return;

    // clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    vehicles.forEach((vehicle) => {
      const el = document.createElement('div');
      el.style.background = '#e00';
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid #fff';
      el.title = vehicle.displayName || vehicle.id;

      const popup = new maplibregl.Popup({ closeOnClick: true }).setHTML(
        `<strong>${vehicle.displayName ?? vehicle.id}</strong><br/>Battery: ${
          vehicle.batteryLevel ?? '?'
        }%`
      );

      const marker = new maplibregl.Marker(el)
        .setLngLat([vehicle.location.lon, vehicle.location.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [vehicles]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
  );
}