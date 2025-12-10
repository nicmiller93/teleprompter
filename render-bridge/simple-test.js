const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Connected');
  const authMessage = JSON.stringify({
    type: 'auth',
    token: 'test-token-123'
  });
  console.log('Sending:', authMessage);
  ws.send(authMessage);
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log('Closed:', code, reason.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('Error:', err.message);
});

setTimeout(() => {
  console.log('Timeout - closing');
  ws.close();
}, 3000);
