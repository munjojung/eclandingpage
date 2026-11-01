// Run locally: node scripts/hash-admin-password.cjs
// WARNING: readline input is visible while typing. Use a private terminal.
const crypto = require('crypto');
const readline = require('readline');
const rl = readline.createInterface({input: process.stdin, output: process.stdout});
rl.question('New admin password (min 16 chars): ', password => {
  rl.close();
  if (password.length < 16) { console.error('At least 16 characters required'); process.exitCode = 1; return; }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {N:16384,r:8,p:1});
  console.log(`scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`);
});
