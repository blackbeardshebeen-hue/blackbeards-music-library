(function(){
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseLocalDate(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function fmtShort(d){return MONTHS[d.getMonth()]+' '+d.getDate();}
function fmtLong(d){return MONTHS[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();}

function entryHTML(ev, full){
  var d = parseLocalDate(ev.date);
  var dateLabel = full ? fmtLong(d) : fmtShort(d);
  var photo = ev.photo ? '<img class="log-photo" src="'+ev.photo+'" alt="" loading="lazy">' : '';
  var link = ev.link ? '<a class="log-link log-more" href="'+ev.link+'" target="_blank" rel="noopener">'+(ev.linkLabel||'More →')+'</a>' : '';
  return '<div class="log-entry'+(full?' log-entry-full anim-entry':'')+'">'+
    '<div class="log-date">'+dateLabel+'</div>'+
    photo+
    '<p class="log-text">'+ev.text+'</p>'+
    link+
  '</div>';
}

function sortNewestFirst(data){
  return data.slice().sort(function(a,b){ return parseLocalDate(b.date) - parseLocalDate(a.date); });
}

// Homepage teaser — latest entry only
function initHome(){
  var root = document.getElementById('cl-latest');
  if (!root) return;
  fetch('captains-log.json').then(function(r){ return r.json(); }).then(function(data){
    if (!data || !data.length) { root.innerHTML = '<p class="log-text">Nothing logged yet — check back soon.</p>'; return; }
    root.innerHTML = entryHTML(sortNewestFirst(data)[0], false);
  }).catch(function(){
    root.innerHTML = '<p class="log-text">Could not load the log right now.</p>';
  });
}

// Full rolling archive — log.html
function initFull(){
  var root = document.getElementById('log-root');
  if (!root) return;
  fetch('captains-log.json').then(function(r){ return r.json(); }).then(function(data){
    if (!data || !data.length) {
      root.innerHTML = '<div class="events-empty"><span class="skull">☠️</span><p>No entries yet — check back soon.</p></div>';
      return;
    }
    root.innerHTML = sortNewestFirst(data).map(function(ev){ return entryHTML(ev, true); }).join('');
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
