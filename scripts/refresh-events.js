#!/usr/bin/env node
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');

function today() { return new Date().toISOString().slice(0, 10); }
function slug(t, d) { return (t + '|' + d).toLowerCase().trim(); }
function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

function parseDate(str) {
  if (!str) return null;
  str = clean(str);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4})?/i);
  if (m) {
    const mo = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}[m[1].toLowerCase().slice(0,3)];
    const dy = parseInt(m[2]);
    const y = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    if (mo && dy) return y+'-'+String(mo).padStart(2,'0')+'-'+String(dy).padStart(2,'0');
  }
  return null;
}

function isBogus(name) {
  if (!name || name.length < 2) return true;
  // Presenter/promo text
  if (/\.\.\.\s*$/.test(name)) return true;
  // Parenthetical descriptions like "(tribute to KISS)"
  if (/^\(/.test(name)) return true;
  // Clarification text like "not the Canadian indie pop band..."
  if (/^(not the|performing |featuring$|^featuring\b)/i.test(name)) return true;
  // Contains newlines (multi-line = merged text)
  if (/\n/.test(name)) return true;
  // Only punctuation / numbers / whitespace
  if (!/[a-zA-Z]{2}/.test(name)) return true;
  // Very long = description, not a name
  if (name.length > 80) return true;
  return false;
}

async function safeFetch(url) {
  try {
    const r = await fetch(url, {
      headers: {'User-Agent':'Mozilla/5.0'},
      timeout: 12000
    });
    return r.ok ? await r.text() : null;
  } catch(e) { console.warn('Fetch failed:', url, e.message); return null; }
}

async function scrapeBottomOfTheHill() {
  console.log('Scraping Bottom of the Hill...');
  const html = await safeFetch('https://www.bottomofthehill.com/calendar.html');
  if (!html) return [];
  const $ = cheerio.load(html);
  const events = [];
  const cutoff = today();

  $('p').each((i, para) => {
    const dateStr = parseDate(clean($(para).text()));
    if (!dateStr || dateStr < cutoff) return;

    // Show URL from date-based link
    let showLink = 'https://www.bottomofthehill.com/calendar.html';
    $(para).find('a').each((j, a) => {
      const href = $(a).attr('href') || '';
      if (/\d{8}\.html/.test(href)) showLink = href;
    });

    // Collect all valid band names from <big> tags
    const bands = [];
    $(para).find('big').each((j, big) => {
      const name = clean($(big).text());
      if (!isBogus(name)) bands.push(name);
    });

    if (bands.length === 0) return;

    // Headliner = first valid band; rest are support acts
    const headliner = bands[0];
    const support = bands.slice(1);
    const desc = support.length > 0
      ? headliner + ' w/ ' + support.join(', ') + ' — live at Bottom of the Hill, SF.'
      : headliner + ' live at Bottom of the Hill, SF.';

    events.push({
      title: headliner.slice(0, 100),
      date: dateStr,
      time: '9:00 PM',
      venue: 'Bottom of the Hill',
      address: '1233 17th St, San Francisco, CA 94107',
      city: 'san francisco',
      genre: 'live music',
      description: desc.slice(0, 250),
      link: showLink.startsWith('http') ? showLink : 'https://www.bottomofthehill.com/' + showLink
    });
  });

  // Dedup by date (one entry per night)
  const seen = new Set();
  const deduped = events.filter(e => {
    if (seen.has(e.date)) return false;
    seen.add(e.date); return true;
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

  $('[class*="tribe-event"],[class*="type-tribe"],article[class*="event"]').each((i, el) => {
    const title = clean($(el).find('h2,h3,.tribe-event-title,.entry-title').first().text());
    if (!title || title.length < 3) return;
    const dtAttr = $(el).find('[datetime]').first().attr('datetime') || '';
    const dtText = clean($(el).find('[class*="date"],time,.tribe-event-date-start').first().text());
    const dateStr = parseDate(dtAttr) || parseDate(dtText);
    if (!dateStr || dateStr < cutoff) return;
    const link = $(el).find('a').first().attr('href') || 'https://www.rhythmix.org/events';
    const desc = clean($(el).find('p,.description').first().text());
    events.push({
      title: title.slice(0,100), date: dateStr,
      time: clean($(el).find('[class*="time"]').first().text()) || '7:00 PM',
      venue: 'Rhythmix Cultural Works', address: '2513 Blanding Ave, Alameda, CA 94501',
      city: 'alameda', genre: 'live music',
      description: (desc || title + ' at Rhythmix Cultural Works in Alameda.').slice(0,200),
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

  $('[class*="event"],article').each((i, el) => {
    const title = clean($(el).find('h2,h3,h4,.event-title').first().text());
    if (!title || title.length < 3) return;
    const dtAttr = $(el).find('[datetime]').first().attr('datetime') || '';
    const dtText = clean($(el).find('[class*="date"],time').first().text());
    const dateStr = parseDate(dtAttr) || parseDate(dtText);
    if (!dateStr || dateStr < cutoff) return;
    const link = $(el).find('a').first().attr('href') || 'https://www.thefoxoakland.com/events/';
    events.push({
      title: title.slice(0,100), date: dateStr, time: '8:00 PM',
      venue: 'Fox Theater Oakland', address: '1807 Telegraph Ave, Oakland, CA 94612',
      city: 'oakland', genre: 'live music',
      description: title + ' live at the Fox Theater in Oakland.',
      link: link.startsWith('http') ? link : 'https://www.thefoxoakland.com' + link
    });
  });
  console.log('Fox Oakland found:', events.length);
  return events;
}

async function main() {
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(EVENTS_PATH,'utf8')); console.log('Loaded', existing.length, 'existing'); }
  catch(e) { console.warn('No existing events:', e.message); }

  const existingSlugs = new Set(existing.map(e => slug(e.title, e.date)));
  const cutoff = today();
  const scraped = (await Promise.all([scrapeBottomOfTheHill(), scrapeRhythmix(), scrapeFoxOakland()])).flat();

  const kept = existing.filter(e => e.date >= cutoff);
  let added = 0;

  for (const ev of scraped) {
    if (!ev.date || ev.date < cutoff || !ev.title || ev.title.length < 2) continue;
    const k = slug(ev.title, ev.date);
    if (!existingSlugs.has(k)) {
      kept.push(ev); existingSlugs.add(k); added++;
      console.log('+ Added:', ev.date, '|', ev.title);
    }
  }

  kept.sort((a,b) => a.date.localeCompare(b.date));
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(kept, null, 2));
  console.log('Done. Total:', kept.length, '| Added:', added);
}

main().catch(e => { console.error(e); process.exit(1); });
