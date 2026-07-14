/**
 * One-time helper: generates a Gmail OAuth2 refresh token for MailerService.
 *
 * Run this LOCALLY on your own machine (not on Render) -- it needs to open
 * a browser for a one-time Google consent screen.
 *
 * SETUP (in Google Cloud Console, https://console.cloud.google.com):
 *   1. Create a project (or use an existing one).
 *   2. APIs & Services -> Library -> enable the "Gmail API".
 *   3. APIs & Services -> OAuth consent screen -> configure it (External is
 *      fine; add the Gmail address you'll send FROM as a test user if the
 *      app is in "Testing" mode -- otherwise Google will refuse to
 *      authorize it).
 *   4. APIs & Services -> Credentials -> Create Credentials -> OAuth client
 *      ID -> Application type: "Desktop app". Copy the Client ID and
 *      Client Secret it gives you.
 *
 * USAGE:
 *   cd apps/api
 *   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy npx ts-node scripts/generate-gmail-refresh-token.ts
 *
 * It will print a URL. Open it, sign in with the Gmail address you want to
 * send FROM, and approve access. The script then prints your refresh token
 * -- put that, plus the client id/secret and the Gmail address, into your
 * .env (see .env.example for the exact variable names) and restart the API.
 */
import { OAuth2Client } from 'google-auth-library';
import * as http from 'http';

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables first.');
    process.exit(1);
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces Google to issue a refresh token even on repeat runs
    scope: ['https://www.googleapis.com/auth/gmail.send'],
  });

  console.log('\nOpen this URL in your browser and sign in with the Gmail account you want to send FROM:\n');
  console.log(authUrl);
  console.log(`\nWaiting for you to approve access (listening on ${REDIRECT_URI})...\n`);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', REDIRECT_URI);
      const authCode = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.end('Authorization failed. You can close this tab and check the terminal.');
        server.close();
        reject(new Error(`Google returned an error: ${error}`));
        return;
      }

      if (authCode) {
        res.end('Success! You can close this tab and go back to the terminal.');
        server.close();
        resolve(authCode);
      }
    });
    server.listen(PORT);
  });

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      '\nGoogle did not return a refresh token. This usually means you already granted access before. ' +
        'Revoke access at https://myaccount.google.com/permissions and run this script again.\n',
    );
    process.exit(1);
  }

  console.log('\nDone! Add these to your .env (and to Render\'s environment variables):\n');
  console.log(`GMAIL_CLIENT_ID=${clientId}`);
  console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('GMAIL_SENDER_EMAIL=<the Gmail address you just signed in with>');
  console.log('GMAIL_SENDER_NAME=PayHarness\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
