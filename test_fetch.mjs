import https from 'https';

function fetchUrl(url) {
  return new Promise((resolve) => {
    console.log(`Fetching ${url}...`);
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data.slice(0, 500)
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        error: err.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ error: 'Timeout' });
    });
  });
}

(async () => {
  const urls = [
    'https://the-leetcode-city.vercel.app/api/arena/challenge/today',
    'https://theleetcodecity.tech/api/arena/challenge/today'
  ];

  for (const url of urls) {
    const res = await fetchUrl(url);
    console.log(`Result for ${url}:`, res);
  }
})();
