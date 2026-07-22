import * as http from 'http';
import * as https from 'https';

/**
 * Confirms a URL resolves and something responds -- used to check that a
 * generated webhook callback URL is actually reachable. Any response at
 * all (even a 404/405 for a HEAD the route doesn't explicitly support)
 * counts as reachable; only a connection failure or timeout means it isn't.
 */
export function checkUrlReachable(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const client = parsed.protocol === 'http:' ? http : https;
    return new Promise<boolean>((resolve) => {
      const request = client.request(
        { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'HEAD', timeout: timeoutMs },
        (res) => {
          res.resume();
          resolve(Boolean(res.statusCode));
        },
      );
      request.on('error', () => resolve(false));
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
      request.end();
    });
  } catch {
    return Promise.resolve(false);
  }
}
