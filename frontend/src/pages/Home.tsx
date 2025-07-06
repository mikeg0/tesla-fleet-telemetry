import MapView from '../components/MapView';

export default function Home() {
  // TODO: fetch real vehicle location from API
  const mockCenter: [number, number] = [-122.4194, 37.7749]; // San Francisco

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <MapView center={mockCenter} />
    </div>
  );
}