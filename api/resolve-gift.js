module.exports = async (req, res) => {
  const { url = '' } = req.query || {};
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const raw = String(url || '').trim();
    if (!/^https?:\/\//i.test(raw)) {
      return res.status(400).json({ error: 'invalid_url' });
    }

    const response = await fetch(raw, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(15000),
    });

    const finalUrl = response.url || raw;
    const liveMatch = finalUrl.match(/session=(\d+)/);
    const cleanUrl = liveMatch
      ? `https://live.shopee.vn/share?from=live&session=${liveMatch[1]}`
      : finalUrl;

    return res.status(200).json({ ok: true, url: cleanUrl });
  } catch (error) {
    return res.status(200).json({ ok: false, url: String(url || '').trim() || 'https://shopee.vn/' });
  }
};
