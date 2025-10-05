// Test simple para verificar CORS
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/health',
  method: 'GET',
  headers: {
    'Origin': 'http://localhost:5173'
  }
};

console.log('🧪 Probando conexión al backend...\n');

const req = http.request(options, (res) => {
  console.log(`✅ STATUS: ${res.statusCode}`);
  console.log(`✅ HEADERS:\n`, JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n✅ RESPONSE BODY:', data);
  });
});

req.on('error', (e) => {
  console.error(`❌ ERROR: ${e.message}`);
});

req.end();
