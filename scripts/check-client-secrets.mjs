import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes:true }))
  .map(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();

const files = await walk('.next/static');
const patterns = [
  /SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY|JWT_SECRET)/,
  /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE|PASSWORD|DATABASE)/,
  /sb_secret_[A-Za-z0-9_-]+/,
  /["']role["']\s*:\s*["']service_role["']/,
  /postgres(?:ql)?:\/\//,
];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  if (patterns.some(pattern => pattern.test(content))) throw new Error(`Privileged value or name found in client asset: ${file}`);
}

console.log('Client bundle secret check passed.');
