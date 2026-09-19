(function(){
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtShort(d){return MONTHS[d.getMonth()]+' '+d.getDate();}
function fmtLong(d){return MONTHS[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();}

// Plain-text log format — one entry per block, blocks separated by a line
// of three or more dashes ( --- ). Each entry is a set of "Label: value"
// lines; order doesn't matter and Link/Link label/Photo are all optional.
//
//   Date: September 19, 2026
//   Text: Whatever you want to say. Can span
//   multiple lines if you want.
//   Link: https://example.com
//   Link label: More info
//   Photo: https://example.com/photo.jpg
//   ---
function parseLog(raw){
  raw = raw.replace(/\r\n/g, '\n');
  var blocks = raw.split(/^-{3,}\s*$/m).map(function(b){ return b.trim(); }).filter(Boolean);
  var entries = blocks.map(function(block){
    var lines = block.split('\n');
    var entry = { date: null, text: '', link: null, linkLabel: null, photo: null };
    var mode = null, sawTextLabel = false, loose = [];
    lines.forEach(function(line){
      var m;
      if ((m = line.match(/^Date:\s*(.+)$/i))) { entry.date = m[1].trim(); mode = null; }
      else if ((m = line.match(/^Text:\s*(.*)$/i))) { entry.text = m[1]; mode = 'text'; sawTextLabel = true; }
      else if ((m = line.match(/^Link label:\s*(.+)$/i))) { entry.linkLabel = m[1].trim(); mode = null; }
      else if ((m = line.match(/^Link:\s*(.+)$/i))) { entry.link = m[1].trim(); mode = null; }
      else if ((m = line.match(/^Photo:\s*(.+)$/i))) { entry.photo = m[1].trim(); mode = null; }
      else if (mode === 'text' && line.trim()) { entry.text += (entry.text ? '\n' : '') + line; }
      else if (line.trim()) { loose.push(line.trim()); }
    });
    // Forgiving fallback: if there's no "Text:" label, treat whatever plain
    // lines are in the block as the entry text, so a bare note still shows up.
    if (!sawTextLabel && loose.length) {
      if (!entry.date && !isNaN(new Date(loose[0]))) { entry.date = loose.shift(); }
      entry.text = loose.join('\n');
    }
    entry.text = entry.text.trim();
    entry._d = entry.date ? new Date(entry.date) : new Date(0);
    return entry;
  }).filter(function(e){ return e.text; });
  entries.sort(function(a, b){ return b._d - a._d; });
  return entries;
}

function entryHTML(ev, full){
  var hasDate = ev.date && ev._d && !isNaN(ev._d);
  var dateLabel = hasDate ? (full ? fmtLong(ev._d) : fmtShort(ev._d)) : '';
  var photo = ev.photo ? '<img class="log-photo" src="'+ev.photo+'" alt="" loading="lazy">' : '';
  var link = ev.link ? '<a class="log-link log-more" href="'+ev.link+'" target="_blank" rel="noopener">'+(ev.linkLabel||'More →')+'</a>' : '';
  var textHTML = ev.text.split('\n').filter(Boolean).map(function(p){ return '<p class="log-text">'+p+'</p>'; }).join('');
  return '<div class="log-entry'+(full?' log-entry-full anim-entry':'')+'">'+
    (dateLabel ? '<div class="log-date">'+dateLabel+'</div>' : '')+
    photo+
    textHTML+
    link+
  '</div>';
}

// Homepage teaser — latest entry only
function initHome(){
  var root = document.getElementById('cl-latest');
  if (!root) return;
  fetch('captains-log.txt', { cache: 'no-store' }).then(function(r){ return r.text(); }).then(function(raw){
    var entries = parseLog(raw);
    if (!entries.length) { root.innerHTML = '<p class="log-text">Nothing logged yet — check back soon.</p>'; return; }
    root.innerHTML = entryHTML(entries[0], false);
  }).catch(function(){
    root.innerHTML = '<p class="log-text">Could not load the log right now.</p>';
  });
}

// Full rolling archive — log.html
function initFull(){
  var root = document.getElementById('log-root');
  if (!root) return;
  fetch('captains-log.txt', { cache: 'no-store' }).then(function(r){ return r.text(); }).then(function(raw){
    var entries = parseLog(raw);
    if (!entries.length) {
      root.innerHTML = '<div class="events-empty"><span class="skull">☠️</span><p>No entries yet — check back soon.</p></div>';
      return;
    }
    root.innerHTML = entries.map(function(ev){ return entryHTML(ev, true); }).join('');
    requestAnimationFrame(function(){
      root.querySelectorAll('.log-entry-full.anim-entry').forEach(function(el, i){
        setTimeout(function(){ el.classList.add('visible'); }, i * 60);
      });
    });
  }).catch(function(){
    root.innerHTML = '<div class="events-empty"><span class="skull">⚓</span><p>Could not load the log. Try refreshing.</p></div>';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ initHome(); initFull(); });
} else {
  initHome(); initFull();
}
})();
