'use strict';

const origin = process.env.SITE_ORIGIN || 'https://saad-ewida-science-platform.vercel.app';
const region = 'europe-west1';
const project = 'saad-ewida-science-platform';
const functions = ['platformApi'];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function verifyPreflight(name) {
  const url = `https://${region}-${project}.cloudfunctions.net/${name}`;
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type'
        },
        signal: AbortSignal.timeout(15000)
      });
      const allowed = response.headers.get('access-control-allow-origin');
      if (response.ok && (allowed === '*' || allowed === origin)) {
        console.log(`âœ“ ${name}: CORS preflight ${response.status}, origin ${allowed}`);
        return;
      }
      lastError = new Error(`${name}: HTTP ${response.status}; Access-Control-Allow-Origin=${allowed || 'missing'}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 6) await wait(5000);
  }
  throw lastError;
}

Promise.all(functions.map(verifyPreflight)).then(() => {
  console.log('Production Cloud Functions CORS verification passed.');
}).catch(error => {
  console.error('Production Cloud Functions verification failed:', error.message || error);
  console.error('Confirm that platformApi is public and that the Firebase Functions deployment completed.');
  process.exitCode = 1;
});

