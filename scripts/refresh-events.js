#!/usr/bin/env node
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slug(title, date) {
  return (title + '|' + date).toLowerCase().trim();
}

function cleanText(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function parseDate(str) {
  if (!str) return null;
  str = cleanText(str);
  const yr = new Date().getFullYear();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // "July 10, 2026" or "Jul 10 2026"
  const m1 = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4})?/i);
  if (m1) {
    const mo = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}[m1[1].toLowerCase().slice(0,3)];
    const dy = parseInt(m1[2]);
    const y = m1[3] ? parseInt(m1[3]) : yr;
    if (mo && dy) return y+'-'+String(mo).padStart(2,'0')+'-'+String(dy).padStart(2,'0');
  }

  // ISO date in datetime attr
  const m2 = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[0];

  return null;
}

async function safeFetch(url) {
  try {
    const r = await fetch(url, {
      headers: {'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'},
      timeout: 12000
    });
    return r.ok ? await r.text() : null;
  } catch(e) {
    console.warn('Fetch failed:', url, e.message);
    return null;
  }
}

async function scrapeBottomOfTheHill() {
  console.log('Scraping Bottom of the Hill...');
  const html = await safeFetch('https://www.bottomofthehill.com/calendar.html');
  if (!html) return [];
  const $ = cheerio.load(html);
  const events = [];
  const cutoff = today();

  // BoTH has show blocks — find date headers and band names
  // Their calendar uses font tags and tables — look for strong/b tags with band names near date text
  $('p, td, div').each((i, el) => {
    const text = cleanText($(el).text());

    // Skip sold-out notices, short labels, nav items
    if (text.length < 5 || text.length > 300) return;
    if (/sold out|tickets|doors|adv|\$/i.test(text) && text.length < 60) return;
    if (/^(mon|tue|wed|thu|fri|sat|sun)$/i.test(text)) return;

    // Must have a date pattern
    const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}/i);
    if (!dateMatch) return;

    const dateStr = parseDate(dateMatch[0] + ' ' + new Date().getFullYear());
    if (!dateStr || dateStr < cutoff) return;

    // Title: first bold/strong/link, or clean the date out of the text
    const title = cleanText($(el).find('strong, b, a').first().text())
               || cleanText(text.replace(dateMatch[0], '').replace(/^[^a-z]*/i, '')).slice(0, 80);

    if (!title || title.length < 4) return;
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(title)) return;
    if (/sold out|tickets|calendar|shows/i.test(title)) return;

    const link = $(el).find('a[href]').first().attr('href');
    const fullLink = link ? (link.startsWith('http') ? link : 'https://www.bottomofthehill.com/' + link) : 'https://www.bottomofthehill.com/calendar.html';

    events.push({
      title: title.slice(0, 100),
      date: dateStr,
      time: '9:00 PM',
      venue: 'Bottom of the Hill',
      address: '1233 17th St, San Francisco, CA 94107',
      city: 'san francisco',
      genre: 'live music',
      description: title + ' live at Bottom of the Hill.',
      link: fullLink
    });
  });

  // Dedup by date+title within this batch
  const seen = new Set();
  const deduped = events.filter(e => {
    const k = slug(e.title, e.date);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  console.log('BoTH found:', deduped.length);
  return deduped;
}

async function scrapeRhythmix() {
  console.log('Scraping Rhythmix...');
  const html = await safeFetch('https://www.rhythmix.org/events');
  if (!html) return [];
  const $ = cheerio.load(html);
  const events = [];
  const cutoff = today();

  $('[class*="tribe-event"], [class*="type-tribe"], article[class*="event"]').each((i, el) => {
    const title = cleanText($(el).find('h2,h3,.tribe-event-title,.entry-title').first().text());
    if (!title || title.length < 3) return;

    const dtAttr = $(el).find('[datetime]').first().attr('datetime') || '';
    const dtText = cleanText($(el).find('[class*="date"],time,.tribe-event-date-start').first().text());
    const dateStr = parseDate(dtAttr) || parseDate(dtText);
    if (!dateStr || dateStr < cutoff) return;

    const link = $(el).find('a').first().attr('href') || 'https://www.rhythmix.org/events';
    const desc = cleanText($(el).find('p,.description').first().text());

    events.push({
      title: title.slice(0, 100),
      date: dateStr,
      time: cleanText($(el).find('[class*="time"],.tribe-event-time').first().text()) || '7:00 PM',
      venue: 'Rhythmix Cultural Works',
      address: '2513 Blanding Ave, Alameda, CA 94501',
      city: 'alameda',
      genre: 'live music',
      description: (desc || title + ' at Rhythmix Cultural Works in Alameda.').slice(0, 200),
      link: link.startsWith('http') ? link : 'https://www.rhythmix.org' + link
    });
  });

  console.log('Rhythmix found:', events.length);
  return events;
}

async function scrapeFoxOakland() {
  console.log('Scraping Fox Oakland...');
  const html = await safeFetch('https://www.thefoxoakland.com/events/');
  if (!html) return [];
  const $ = cheerio.load(html);
  const events = [];
  const cutoff = today();

  $('[class*="event"], article').each((i, el) => {
    const title = cleanText($(el).find('h2,h3,h4,.event-title').first().text());
    if (!title || title.length < 3) return;

    const dtAttr = $(el).find('[datetime]').first().attr('datetime') || '';
    const dtText = cleanText($(el).find('[class*="date"],time').first().text());
    const dateStr = parseDate(dtAttr) || parseDate(dtText);
    if (!dateStr || dateStr < cutoff) return;

    const link = $(el).find('a').first().attr('href') || 'https://www.thefoxoakland.com/events/';
    events.push({
      title: title.slice(0, 100),
      date: dateStr,
      time: '8:00 PM',
      venue: 'Fox Theater Oakland',
      address: '1807 Telegraph Ave, Oakland, CA 94612',
      city: 'oakland',
      genre: 'live music',
      description: title + ' live at the Fox Theater in Oakland.',
      link: link.startsWith('http') ? link : 'https://www.thefoxoakland.com' + link
    });
  });

  console.log('Fox Oakland found:', events.length);
  return events;
}

async function main() {
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
    console.log('Loaded', existing.length, 'existing events');
  } catch(e) { console.warn('Could not read events.json:', e.message); }

  const existingSlugs = new Set(existing.map(e => slug(e.title, e.date)));
  const cutoff = today();

  const scraped = (await Promise.all([
    scrapeBottomOfTheHill(),
    scrapeRhythmix(),
    scrapeFoxOakland()
  ])).flat();

  // Keep future existing events, add genuinely new scraped ones
  const kept = existing.filter(e => e.date >= cutoff);
  let added = 0;

  for (const ev of scraped) {
    if (!ev.date || ev.date < cutoff) continue;
    if (!ev.title || ev.title.length < 4) continue;
    const k = slug(ev.title, ev.date);
    if (!existingSlugs.has(k)) {
      kept.push(ev);
      existingSlugs.add(k);
      added++;
      console.log('+ Added:', ev.date, ev.title);
    }
  }

  kept.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(kept, null, 2));
  console.log('Done. Total:', kept.length, '| Added:', added, '| Dropped past:', existing.length - kept.length + added);
}

main().catch(e => { console.error(e); process.exit(1); });
