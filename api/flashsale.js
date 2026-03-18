const fs = require('fs');
const path = require('path');

const API_BASE = 'https://hupvoi.net/flashsale/api/flash_sale.php';
const FALLBACK_PRODUCTS_PATH = path.join(__dirname, '..', 'flashsale', 'fallback-products.json');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Referer': 'https://hupvoi.net/flashsale',
  'Origin': 'https://hupvoi.net',
  'Accept': 'application/json, text/plain, */*'
};

const cache = {
  promotions: null,
  productsByPromotion: new Map(),
};

function readFallbackProducts() {
  try {
    return JSON.parse(fs.readFileSync(FALLBACK_PRODUCTS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function buildFallbackPromotions() {
  const now = new Date();
  const slots = [0, 9, 12, 15, 18, 21];
  return slots.map((hour) => {
    const d = new Date(now);
    d.setHours(hour, 0, 0, 0);
    return {
      promotionid: `${String(hour).padStart(2, '0')}:00`,
      start_time: Math.floor(d.getTime() / 1000),
      end_time: Math.floor(d.getTime() / 1000) + 10800,
      sale_slot: `${String(hour).padStart(2, '0')}:00`,
      sale_date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    };
  });
}

async function fetchTextWithRetry(url, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

module.exports = async (req, res) => {
  const { action = '', promotionid = '', keyword = '' } = req.query || {};
  const isPromotions = action === 'promotions';

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', isPromotions ? 's-maxage=120, stale-while-revalidate=240' : 's-maxage=12, stale-while-revalidate=24');
  res.setHeader('X-Flashsale-Source', 'unknown');

  try {
    const url = new URL(API_BASE);
    if (isPromotions) {
      url.searchParams.set('action', 'promotions');
    } else {
      if (promotionid) url.searchParams.set('promotionid', String(promotionid));
      if (keyword) url.searchParams.set('keyword', String(keyword));
    }

    const text = await fetchTextWithRetry(url.toString(), 2);
    const data = JSON.parse(text);

    if (isPromotions) {
      if (Array.isArray(data) && data.length) {
        cache.promotions = data;
        res.setHeader('X-Flashsale-Source', 'upstream');
        res.status(200).send(JSON.stringify(data));
        return;
      }
      res.setHeader('X-Flashsale-Source', cache.promotions ? 'cache' : 'fallback');
      res.status(200).send(JSON.stringify(cache.promotions || buildFallbackPromotions()));
      return;
    }

    if (Array.isArray(data) && data.length) {
      if (promotionid) cache.productsByPromotion.set(String(promotionid), data);
      res.setHeader('X-Flashsale-Source', 'upstream');
      res.status(200).send(JSON.stringify(data));
      return;
    }

    const cached = promotionid ? cache.productsByPromotion.get(String(promotionid)) : null;
    const fallback = cached || readFallbackProducts();
    res.setHeader('X-Flashsale-Source', cached ? 'cache' : 'fallback');
    res.status(200).send(JSON.stringify(fallback));
  } catch (error) {
    if (isPromotions) {
      res.setHeader('X-Flashsale-Source', cache.promotions ? 'cache' : 'fallback');
      res.status(200).send(JSON.stringify(cache.promotions || buildFallbackPromotions()));
      return;
    }

    const cached = promotionid ? cache.productsByPromotion.get(String(promotionid)) : null;
    const fallback = cached || readFallbackProducts();
    res.setHeader('X-Flashsale-Source', cached ? 'cache' : 'fallback');
    res.status(200).send(JSON.stringify(fallback));
  }
};
