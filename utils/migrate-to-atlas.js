const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config({ override: true });

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

function getTargetUri() {
  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in .env');

  const dbName = process.env.DATABASE_NAME || 'sehatsure';

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

async function migrateData() {
  const localUri = 'mongodb://127.0.0.1:27017/dlms';
  const targetUri = getTargetUri();

  console.log('===========================================================');
  console.log('MongoDB Live Cluster Migration');
  console.log('Source: ', localUri);
  console.log('Target: ', targetUri.replace(/:([^:@]+)@/, ':****@'));
  console.log('===========================================================');

  const localConn = await mongoose.createConnection(localUri).asPromise();
  console.log('[1/4] Connected to local database.');

  let targetConn;
  try {
    targetConn = await mongoose.createConnection(targetUri).asPromise();
    console.log('[2/4] Connected to live Atlas database.');
  } catch (err) {
    console.error('\n[Error connecting to Atlas]:', err.message);
    if (err.message.includes('authentication failed')) {
      console.error('\n>>> Authentication failed with Atlas!');
      console.error('Please verify the Database User password in MongoDB Atlas:');
      console.error('1. Go to cloud.mongodb.com -> Database Access');
      console.error('2. Ensure user "janmejaysingh1201_db_user" has "Read and write to any database"');
      console.error('3. Click "Edit" -> "Edit Password" -> Set/Copy the password');
      console.error('4. Update the password in your .env file.\n');
    }
    process.exit(1);
  }

  console.log('[3/4] Transferring all collections...');
  const collections = ['departments', 'hostels', 'users', 'leaves', 'audits', 'filedocs'];

  for (const colName of collections) {
    const sourceCol = localConn.collection(colName);
    const targetCol = targetConn.collection(colName);

    const docs = await sourceCol.find({}).toArray();
    console.log(` - ${colName}: found ${docs.length} records in local db.`);

    if (docs.length > 0) {
      // Clear target collection first to avoid duplicates or id collisions
      await targetCol.deleteMany({});
      await targetCol.insertMany(docs);
      console.log(`   --> Copied ${docs.length} ${colName} to Atlas live cluster.`);
    }
  }

  console.log('[4/4] Migration completed successfully! All data is now live on MongoDB Atlas.');
  await localConn.close();
  await targetConn.close();
  process.exit(0);
}

migrateData().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
