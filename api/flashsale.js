module.exports = async (req, res) => {
  const { action = '', promotionid = '', keyword = '' } = req.query || {};
  const API_BASE = 'https://hupvoi.net/flashsale/api/flash_sale.php';

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Referer': 'https://hupvoi.net/flashsale',
    'Origin': 'https://hupvoi.net',
    'Accept': 'application/json, text/plain, */*'
  };

  try {
    const url = new URL(API_BASE);
    if (action === 'promotions') {
      url.searchParams.set('action', 'promotions');
    } else {
      if (promotionid) url.searchParams.set('promotionid', String(promotionid));
      if (keyword) url.searchParams.set('keyword', String(keyword));
    }

    const upstream = await fetch(url, { headers });
    const text = await upstream.text();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', action === 'promotions' ? 's-maxage=300, stale-while-revalidate=600' : 's-maxage=60, stale-while-revalidate=120');

    if (!upstream.ok) {
      res.status(upstream.status).send(JSON.stringify({ error: 'upstream_error', status: upstream.status, body: text.slice(0, 500) }));
      return;
    }

    res.status(200).send(text);
  } catch (error) {
    res.status(500).json({ error: 'proxy_failed', message: error.message || 'Unknown error' });
  }
};
