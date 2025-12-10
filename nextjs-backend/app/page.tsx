export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Teleprompter Backend</h1>
      <p>API endpoints:</p>
      <ul>
        <li>
          <code>GET /api/token</code> - Generate JWT for WebSocket authentication
        </li>
      </ul>
      <p style={{ marginTop: '2rem', color: '#666' }}>
        This service provides JWT tokens for the Teleprompter WebSocket bridge.
      </p>
    </main>
  );
}
