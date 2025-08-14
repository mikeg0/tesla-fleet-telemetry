import { useAuth } from '../AuthProvider';

export default function Login() {
  const { signIn } = useAuth();

  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}
    >
      <button
        onClick={signIn}
        style={{ fontSize: 20, padding: '1rem 2rem', cursor: 'pointer' }}
      >
        Sign in with Tesla
      </button>
    </div>
  );
}