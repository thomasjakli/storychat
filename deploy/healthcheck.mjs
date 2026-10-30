import http from 'node:http';

// Health is application liveness, not a provider request or a subscription check.
try {
  const port = Number(process.env.PORT || 8787);
  const host = new URL(process.env.STORYCHAT_ORIGIN || `http://127.0.0.1:${port}`).host;
  const request = http.get({ hostname: '127.0.0.1', port, path: '/health', headers: { Host: host }, timeout: 5000 }, response => {
    response.resume();
    response.on('end', () => { process.exitCode = response.statusCode === 200 ? 0 : 1; });
    response.on('error', () => { process.exitCode = 1; });
  });
  request.on('timeout', () => request.destroy());
  request.on('error', () => { process.exitCode = 1; });
} catch { process.exitCode = 1; }
