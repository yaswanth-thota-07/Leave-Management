const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers for Windows SRV record resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore if unsupported in environment
}

function getMongoUri() {
  let uri = process.env.MONGODB_URI;
  if (!uri) return 'mongodb://127.0.0.1:27017/dlms';

  const dbName = process.env.DATABASE_NAME || 'dlms';

  if (uri.startsWith('mongodb+srv://')) {
    const urlParts = uri.split('?');
    let base = urlParts[0].replace(/\/+$/, '');
    const query = urlParts[1] || 'retryWrites=true&w=majority';

    if (base.endsWith('.mongodb.net')) {
      base = base + '/' + dbName;
    }
    return base + (query ? '?' + query : '');
  }

  return uri;
}

async function connectDB() {
  const uri = getMongoUri();
  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected successfully to: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`[MongoDB] Connection error: ${err.message}`);
    throw err;
  }
}

module.exports = connectDB;
