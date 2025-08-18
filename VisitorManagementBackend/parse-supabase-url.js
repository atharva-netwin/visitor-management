// Helper script to parse Supabase connection string
// Usage: node parse-supabase-url.js "your-connection-string"

const connectionString = process.argv[2];

if (!connectionString) {
  console.log('Usage: node parse-supabase-url.js "postgresql://postgres:password@host:port/database"');
  console.log('');
  console.log('Example:');
  console.log('node parse-supabase-url.js "postgresql://postgres:mypass@db.xxx.supabase.co:5432/postgres"');
  process.exit(1);
}

try {
  const url = new URL(connectionString);
  
  console.log('=== Supabase Connection Details ===');
  console.log('');
  console.log('Copy these values to your .env.local file:');
  console.log('');
  console.log(`DB_HOST=${url.hostname}`);
  console.log(`DB_PORT=${url.port || 5432}`);
  console.log(`DB_NAME=${url.pathname.substring(1)}`);
  console.log(`DB_USER=${url.username}`);
  console.log(`DB_PASSWORD=${decodeURIComponent(url.password)}`);
  console.log('DB_SSL=true');
  console.log('');
  console.log('=== URL-Encoded Password (use this if password has special characters) ===');
  console.log(`DB_PASSWORD=${url.password}`);
  
} catch (error) {
  console.error('Error parsing connection string:', error.message);
  console.log('');
  console.log('Make sure your connection string is in this format:');
  console.log('postgresql://postgres:password@host:port/database');
}