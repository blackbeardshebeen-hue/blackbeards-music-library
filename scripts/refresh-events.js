#!/usr/bin/env node
/**
 * Blackbeard's Bay Area Event Scraper
 * Runs weekly via GitHub Actions, merges new events into events.json
 * Sources: Bottom of the Hill, Rhythmix, Fox Oakland, Greek Berkeley
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');

function slug(title, date) {
  return (title + '|' + date).toLowerCase().replace(/\s+/g, ' ').trim();
}

function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function safeFetch(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlackbeardsBotV1)' },
      timeout: 10000
    });
    return r.ok ? await r.text() : null;
  } catch (e) {
    console.warn('Fetch failed for', url, e.message);
    return null;
  }
}

function parseDate(str) {
  // Try to parse various date formats into YYYY-MM-DD
  if (!str) return null;
  str = str.trim().replace(/\s+/g, ' ');
  const now = new Date();
  const year = now.getFullYear();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // "July 10" or "Jul 10"
  const m1 = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2}),? ?(\d{4})?/i);
  if (m1) {
    const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const mo = months[m1[1].toLowerCase().slice(0,3)];
    const dy = parseInt(m1[2]);
    const yr = m1[3] ? parseInt(m1[3]) : year;
    return yr + '-' + String(mo).padStart(2,'0') + '-' + String(dy).padStart(2,'0');
  }

  // "10/07/2026" or "7/10/26"
  const m2 = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m2) {
    const yr = m2[3].length === 2 ? 2000 + parseInt(m2[3]) : parseInt(m2[3]);
    return yr + '-' + String(m2[1]).padStart(2,'0') + '-' + String(m2[2]).padStart(2,'0');
  }

  return null;
}

// ---- Scrapers ----

async function scrapeBottomOfTheHill() {
  console.log('Scraping Bottom of the Hill...');
  const html = await safeFetch('https://www.bottomofthehill.com/calendar.html');
  if (!html) return [];
  const $ = cheerio.load(html);
  const events = [];

  // BoTH uses tables or divs with show listings
  $('table tr, .show, .event-listing').each((i, el) => {
    const text = $(el).text().trim();
    const link = $(el).find('a').first().attr('href');
    const fullLink = link ? (link.startsWith('http') ? link : 'https://www.bottomofthehill.com/' + link) : 'https://www.bottomofthehill.com/calendar.html';

    // Try to extract date and title from the row text
    const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}/i);
    if (!dateMatch) return;

    const dateStr = parseDate(dateMatch[0] + ' 2026');
    if (!dateStr || dateStr < today()) return;

    // Title is usually first bold/link text
    const title = $(el).find('strong, b, a').first().text().trim() || text.slice(0, 50);
    if (!title || title.length < 3) return;

    events.push({
      title: title.slice(0, 100),
      date: dateStr,
      time: '9:00 PM',
      venue: 'Bottom of the Hill',
      address: '1233 17th St, San Francisco, CA 94107',
      city: 'san francisco',
      genre: 'live music',
      description: title + ' live at Bottom of the Hill, San Francisco\'s beloved indie venue.',
      link: fullLink
    });
  });

  console.log('BoTH found:', events.length);
  return events;
}

async function scrapeRhythmix() {
  console.log('Scraping Rhythmix...');
  const html = await safeFetch('https://www.rhythmix.org/events');
  if (!html) return [];
  const $ = cheerio.load(html);
  const events = [];

  // WordPress events usually use .tribe-event or .type-tribe_events
  $('[class*="tribe-event"], [class*="type-tribe"], article[class*="event"], .event').each((i, el) => {
    const title = $(el).find('h2, h3, .tribe-event-title, .entry-title').first().text().trim();
    const dateText = $(el).find('[class*="date"], time, .tribe-event-date-start').first().text().trim()
                  || $(el).find('[datetime]').first().attr('datetime') || '';
    const link = $(el).find('a').first().attr('href') || 'https://www.rhythmix.org/events';
    const desc = $(el).find('p, .description, .tribe-event-description').first().text().trim();

    if (!title) return;
    const dateStr = parseDate(dateText) || parseDate($(el).find('[datetime]').first().attr('datetime'));
    if (!dateStr || dateStr < today()) return;

    events.push({
      title: title.slice(0, 100),
      date: dateStr,
      time: $(el).find('[class*="time"], .tribe-event-time').first().text().trim() || '7:00 PM',
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

  $('[class*="event"], article, .show-item, .vevent').each((i, el) => {
    const title = $(el).find('h2, h3, h4, .event-title, .summary').first().text().trim();
    const dateText = $(el).find('[class*="date"], time, .dtstart').first().text().trim()
                  || $(el).find('[datetime]').first().attr('datetime') || '';
    const link = $(el).find('a').first().attr('href') || 'https://www.thefoxoakland.com/events/';

    if (!title || title.length < 3) return;
    const dateStr = parseDate(dateText) || parseDate($(el).find('[datetime]').first().attr('datetime'));
    if (!dateStr || dateStr < today()) return;

    events.push({
      title: title.slice(0, 100),
      date: dateStr,
      time: $(el).find('[class*="time"]').first().text().trim() || '8:00 PM',
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

// ---- Main ----

async function main() {
  // Load existing events
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
    console.log('Loaded', existing.length, 'existing events');
  } catch(e) {
    console.warn('Could not load existing events:', e.message);
  }

  const existingSlugs = new Set(existing.map(e => slug(e.title, e.date)));

  // Scrape all sources
  const scraped = (await Promise.all([
    scrapeBottomOfTheHill(),
    scrapeRhythmix(),
    scrapeFoxOakland()
  ])).flat();

  console.log('Total scraped:', scraped.length);

  // Remove past events, add new ones
  const cutoff = today();
  const filtered = existing.filter(e => e.date >= cutoff);
  let added = 0;

  for (const ev of scraped) {
    if (!ev.date || ev.date < cutoff) continue;
    if (!existingSlugs.has(slug(ev.title, ev.date))) {
      filtered.push(ev);
      existingSlugs.add(slug(ev.title, ev.date));
      added++;
    }
  }

  // Sort by date
  filtered.sort((a, b) => a.date.localeCompare(b.date));

  console.log('Final events:', filtered.length, '| Added:', added, '| Removed past events:', existing.length - filtered.length + added);

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(filtered, null, 2));
  console.log('Written to', EVENTS_PATH);
}

main().catch(e => { console.error(e); process.exit(1); });
