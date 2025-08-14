import { useAuth } from '../AuthProvider';

export default function Account() {
  const { user, tokens, signOut } = useAuth();

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    alert('Token copied to clipboard');
  };

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Account Settings</h1>

      {user && (
        <section>
          <h2>User Attributes</h2>
          <pre style={{ background: '#f4f4f4', padding: 12 }}>
            {JSON.stringify(user.attributes, null, 2)}
          </pre>
        </section>
      )}

      {tokens && (
        <section>
          <h2>JWT Tokens</h2>
          <p style={{ fontSize: 14 }}>
            These tokens are cached by Amplify and automatically refreshed. Copy
            them for debugging purposes only.
          </p>
          <div>
            <strong>Access Token</strong>{' '}
            <button onClick={() => copyToken(tokens.accessToken)}>copy</button>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f4f4f4', padding: 12 }}>
              {tokens.accessToken}
            </pre>
          </div>
          <div>
            <strong>ID Token</strong>{' '}
            <button onClick={() => copyToken(tokens.idToken)}>copy</button>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f4f4f4', padding: 12 }}>
              {tokens.idToken}
            </pre>
          </div>
        </section>
      )}

      <button onClick={signOut} style={{ marginTop: 20 }}>
        Sign out
      </button>
    </div>
  );
}