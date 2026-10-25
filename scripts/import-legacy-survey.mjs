import { readFile } from 'node:fs/promises';
const args = process.argv.slice(2),
  file = args.find((a) => !a.startsWith('--'));
if (!file || !process.env.ADMIN_TOKEN || !process.env.PUBLIC_ORIGIN)
  throw new Error('Provide a private JSON file and ADMIN_TOKEN/PUBLIC_ORIGIN environment.');
const payload = JSON.parse(await readFile(file, 'utf8'));
const response = await fetch(
  process.env.PUBLIC_ORIGIN.split(',')[0].replace(/\/$/, '') + '/api/admin/import',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.ADMIN_TOKEN,
    },
    body: JSON.stringify({
      payload,
      dryRun: !args.includes('--apply'),
      publishAvatars: args.includes('--publish'),
    }),
  },
);
const result = await response.json();
if (!response.ok) throw new Error(result.error || 'Import failed');
console.log(JSON.stringify(result, null, 2));
