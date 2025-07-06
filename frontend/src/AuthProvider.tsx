import React, { createContext, useContext, useEffect, useState } from 'react';
import { Amplify, Auth } from 'aws-amplify';

interface AuthContextValue {
  user: any | null | undefined; // undefined while loading
  signIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Configure Amplify once (reads env vars injected by Vite)
Amplify.configure({
  Auth: {
    region: import.meta.env.VITE_AWS_REGION,
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
    userPoolWebClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    oauth: {
      domain: import.meta.env.VITE_COGNITO_DOMAIN,
      redirectSignIn: window.location.origin,
      redirectSignOut: window.location.origin + '/login',
      scope: ['openid', 'email', 'profile', 'vehicle_read', 'vehicle_cmd'],
      responseType: 'code'
    }
  }
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [user, setUser] = useState<any | null | undefined>(undefined);

  useEffect(() => {
    Auth.currentAuthenticatedUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  const signIn = () => {
    Auth.federatedSignIn(); // hosted UI (includes Tesla IdP configured in Cognito)
  };

  const signOut = () => Auth.signOut().then(() => setUser(null));

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};