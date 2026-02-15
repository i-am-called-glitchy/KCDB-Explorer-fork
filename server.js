const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 2764;


const cache = new Map();
const CACHE_TTL = {
  default: 30 * 1000,       // 30s for most queries
  dashboard: 60 * 1000,     // 60s for dashboard/stats queries
  user: 45 * 1000,          // 45s for user profile queries
};

function getCacheKey(params) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return sorted || '__default__';
}

function getCacheTTL(params) {
  if (params.user_id || params.short_id) return CACHE_TTL.user;
  if (params.limit && parseInt(params.limit) >= 500) return CACHE_TTL.dashboard;
  return CACHE_TTL.default;
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttl) {
  // ghetto LRU: because npm install redis felt like overkill
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now(), ttl });
}


app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
}));


app.get('/api/messages', async (req, res) => {
  try {
    const params = { ...req.query };
    const cacheKey = getCacheKey(params);


    const cached = getFromCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }


    const qs = new URLSearchParams(params).toString();
    const url = `https://kcdb.amcalledglitchy.dev/api/messages${qs ? '?' + qs : ''}`;

    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }

    const data = await upstream.json();


    const ttl = getCacheTTL(params);
    setCache(cacheKey, data, ttl);

    res.set('X-Cache', 'MISS');
    res.json(data);

  } catch (err) {
    console.error('[proxy error]', err.message); // node_modules heavier than a black hole but here we are
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    res.status(502).json({ error: 'Failed to reach KCDB API' });
  }
});

// the stats endpoint that does everything so the frontend doesn't have to
let statsCache = { data: null, timestamp: 0 };
const STATS_TTL = 60 * 1000;

app.get('/api/stats', async (req, res) => {
  try {
    if (statsCache.data && Date.now() - statsCache.timestamp < STATS_TTL) {
      res.set('X-Cache', 'HIT');
      return res.json(statsCache.data);
    }


    const [statsRes, msgsRes] = await Promise.all([
      fetch('https://kcdb.amcalledglitchy.dev/api/stats', { signal: AbortSignal.timeout(10000) }),
      fetch('https://kcdb.amcalledglitchy.dev/api/messages?limit=20', { signal: AbortSignal.timeout(10000) })
    ]);

    if (!statsRes.ok) throw new Error(`Stats API ${statsRes.status}`);
    const statsData = await statsRes.json();



    if (statsData.recentMessages && Array.isArray(statsData.recentMessages)) {
      statsData.recentMessages = statsData.recentMessages.filter(m => m.user_name);
    } else {
      statsData.recentMessages = [];
    }


    const stats = {
      totalMessages: statsData.totalMessages || 0,
      sampleSize: statsData.totalMessages || 0,
      today: statsData.today || { count: 0 },
      yesterday: statsData.yesterday || { count: 0 },
      thisHour: statsData.thisHour || 0,
      uniqueUsers: statsData.uniqueUsers || 0,
      avgDaily: statsData.avgDaily || 0,
      dayCounts: statsData.dayCounts || {},
      hourlyTimeline: statsData.hourlyTimeline || [],
      typeCounts: statsData.typeCounts || {},
      topUsers: (statsData.topUsers || []).filter(u => {
        if (!u || !u.name || typeof u.name !== 'string') return false;
        return u.name.trim().length > 0;
      }),
      recentMessages: statsData.recentMessages,
    };

    console.log('[DEBUG] Top Users after filter:', stats.topUsers.length);

    statsCache = { data: stats, timestamp: Date.now() };
    res.set('X-Cache', 'MISS');
    res.json(stats);

  } catch (err) {
    console.error('[stats error]', err.message);
    res.status(502).json({ error: 'Failed to fetch stats' });
  }
});


app.get('/api/cache-stats', (req, res) => {
  res.json({
    entries: cache.size,
    keys: [...cache.keys()].slice(0, 20),
  });
});


app.post('/api/cache-clear', (req, res) => {
  cache.clear();
  res.json({ ok: true });
});


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// if this port is taken I will mass delete everything
app.listen(PORT, () => {
  console.log(`\n  meow KCDB Explorer running at http://localhost:${PORT}\n`);
});
