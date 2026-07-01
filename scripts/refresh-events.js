#!/usr/bin/env node
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');

function today() { return new Date().toISOString().slice(0, 10); }
function slug(t, d) { return (t + '|' + d).toLowerCase().trim(); }
function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

function isBandName(str) {
  if (!str || str.length < 3 || str.length > 120) return false;
  // Reject if it contains show-detail patterns
  if (/\d+:\d+\s*[ap]m|doors|advance|at the door|ages|\$\d|••+|sold out|tickets|presented by|^(mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(str)) return false;
  // Must have at least 2 real word chars
  if (!/[a-z]{2}/i.test(str)) return false;
  return true;
}

function parseDate(str) {
  if (!str) return null;
  str = clean(str);
  const yr = new Date().getFullYear();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m1 = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4})?/i);
  if (m1) {
    const mo = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}[m1[1].toLowerCase().slice(0,3)];
    const dy = parseInt(m1[2]);
    const y = m1[3] ? parseInt(m1[3]) : yr;
    if (mo && dy) return y+'-'+String(mo).padStart(2,'0')+'-'+String(dy).padStart(2,'0');
  }
  const m2 = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[0];
  return null;
}

async function safeFetch(url) {
  try {
    const r = await fetch(url, { headers: {'User-Agent':'Mozilla/5.0'}, timeout: 12000 });
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
  let currentDate = null;

  // Walk all elements in order, tracking the current date context
  $('*').each((i, el) => {
    if (el.children && el.children.length > 1) return; // skip containers, only leaf-ish nodes
    const text = clean($(el).text());
    if (!text || text.length < 2) return;

    // Check if this is a date line
    const dateMatch = text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}/i);
    if (dateMatch) {
      const d = parseDate(text);
      if (d && d >= cutoff) currentDate = d;
      else if (d) currentDate = null;
      return;
    }

    if (!currentDate) return;

    // Check if text looks like a band name (from strong/b/a tags specifically)
    const tag = (el.name || '').toLowerCase();
    if (!['strong','b','a','span','font'].includes(tag)) return;

    const title = clean($(el).text());
    if (!isBandName(title)) return;

    const link = tag === 'a' ? $(el).attr('href') : $(el).closest('p,div,tr').find('a').first().attr('href');
    const fullLink = link ? (link.startsWith('http') ? link : 'https://www.bottomofthehill.com/' + link) : 'https://www.bottomofthehill.com/calendar.html';

    events.push({
      title: title.slice(0, 100),
      date: currentDate,
      time: '9:00 PM',
      venue: 'Bottom of the Hill',
      address: '1233 17th St, San Francisco, CA 94107',
      city: 'san francisco',
      genre: 'live music',
      description: title + ' live at Bottom of the Hill, SF.',
      link: fullLink
    });
  });

  // Dedup within batch
  const seen = new Set();
  const deduped = events.filter(e => {
    const k = slug(e.title, e.date);
    if (seen.has(k)) return false;
    seen.add(k); return true;
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
    if (!ev.date || ev.date < cutoff || !ev.title || ev.title.length < 4) continue;
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
