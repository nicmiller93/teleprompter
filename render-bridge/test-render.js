const WebSocket = require('ws');
const https = require('https');

const VERCEL_TOKEN_URL = 'https://speed-sermon-rttp.vercel.app/api/token';
const WS_URL = 'wss://teleprompter-ws-bridge.onrender.com';

async function getToken() {
  return new Promise((resolve, reject) => {
    https.get(VERCEL_TOKEN_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.token);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function testConnection() {
  console.log('🔑 Fetching JWT token from Vercel...');
  
  try {
    const token = await getToken();
    console.log('✅ Token received:', token.substring(0, 20) + '...');
    
    console.log('\n🔌 Connecting to Render WebSocket bridge...');
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected to Render');
      console.log('🔐 Sending authentication...');
      
      ws.send(JSON.stringify({
        type: 'auth',
        token: token
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received:', JSON.stringify(message, null, 2));
        
        if (message.type === 'connected') {
          console.log('\n🎉 SUCCESS! Render deployment is working!');
          console.log('✅ JWT authentication working');
          console.log('✅ Connected to OpenAI Realtime API');
          console.log('✅ Ready for production use!');
          
          setTimeout(() => {
            console.log('\n👋 Test complete, closing connection...');
            ws.close();
          }, 2000);
        }
      } catch (err) {
        console.log('📨 Received (binary):', data);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`👋 Connection closed: ${code} ${reason || '(no reason)'}`);
      process.exit(0);
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

testConnection();
