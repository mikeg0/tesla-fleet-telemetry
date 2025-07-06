import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Account from './pages/Account';
import { useAuth } from './AuthProvider';

function App() {
  const { user } = useAuth();

  // user === undefined while Amplify checks existing session
  if (user === undefined) {
    return null; // could show a spinner here
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/account"
        element={user ? <Account /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/"
        element={user ? <Home /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;