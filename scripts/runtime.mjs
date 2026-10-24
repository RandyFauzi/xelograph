import { spawn } from 'node:child_process';
const dev = process.argv.includes('--dev'),
  port = process.env.PORT || '3001',
  host = process.env.HOST || '127.0.0.1',
  apiPort = process.env.API_PORT || '3002';
const origins = process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${port},http://localhost:${port}`;
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 200).unref();
}
function launch(args, env) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
  return child;
}
launch([...(dev ? ['--watch'] : []), 'server/index.mjs'], {
  PORT: apiPort,
  HOST: '127.0.0.1',
  PUBLIC_ORIGIN: origins,
  API_ONLY: 'true',
});
launch(
  ['node_modules/next/dist/bin/next', dev ? 'dev' : 'start', '--port', port, '--hostname', host],
  {},
);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
