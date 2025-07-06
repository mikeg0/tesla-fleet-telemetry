import { useAuth } from '../AuthProvider';

export default function Account() {
  const { user, signOut } = useAuth();

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto' }}>
      <h1>Account</h1>
      {user && (
        <>
          <pre>{JSON.stringify(user.attributes, null, 2)}</pre>
          <button onClick={signOut}>Sign out</button>
        </>
      )}
    </div>
  );
}