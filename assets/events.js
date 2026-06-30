(function(){
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var CITY_LABELS={'alameda':'🏴 Alameda','oakland':'🎸 Oakland','berkeley':'🏫 Berkeley','san francisco':'🌉 San Francisco'};
var CITY_ORDER=['alameda','oakland','berkeley','san francisco'];
var allEvents=[],activeCity='all',activeGenre='all',activeWhen='all',searchQuery='';
var root,countEl,clearBtn,searchEl,cityPills,genrePills,whenPills;

function parseLocalDate(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function isFiltered(){return activeCity!=='all'||activeGenre!=='all'||activeWhen!=='all'||searchQuery.length>0;}

function filterEvents(){
  var today=new Date();today.setHours(0,0,0,0);
  var weekEnd=new Date(today);weekEnd.setDate(today.getDate()+7);
  var monthEnd=new Date(today.getFullYear(),today.getMonth()+1,0);
  return allEvents.filter(function(ev){
    var d=parseLocalDate(ev.date);
    if(activeCity!=='all'&&ev.city!==activeCity)return false;
    if(activeGenre!=='all'&&ev.genre!==activeGenre)return false;
    if(activeWhen==='week'&&(d<today||d>weekEnd))return false;
    if(activeWhen==='month'&&(d<today||d>monthEnd))return false;
    if(activeWhen==='july'&&d.getMonth()!==6)return false;
    if(activeWhen==='august'&&d.getMonth()!==7)return false;
    if(searchQuery){var q=searchQuery.toLowerCase();var hay=[ev.title,ev.venue,ev.description,ev.city,ev.genre,ev.address].join(' ').toLowerCase();if(hay.indexOf(q)===-1)return false;}
    return true;
  });
}

function gcalDate(dateStr){return dateStr.replace(/-/g,'');}

function makeICS(ev){
  var d=parseLocalDate(ev.date);
  var dateStr=gcalDate(ev.date);
  var nextDay=new Date(d);nextDay.setDate(d.getDate()+1);
  var nextStr=[nextDay.getFullYear(),String(nextDay.getMonth()+1).padStart(2,'0'),String(nextDay.getDate()).padStart(2,'0')].join('');
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Blackbeards Music Library//EN',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:'+dateStr,
    'DTEND;VALUE=DATE:'+nextStr,
    'SUMMARY:'+ev.title,
    'LOCATION:'+(ev.venue||'')+(ev.address?', '+ev.address:''),
    'DESCRIPTION:'+ev.description+(ev.link?'\n\n'+ev.link:''),
    'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
}

function gcalURL(ev){
  var base='https://calendar.google.com/calendar/render?action=TEMPLATE';
  var ds=gcalDate(ev.date);
  var d=parseLocalDate(ev.date);
  var next=new Date(d);next.setDate(d.getDate()+1);
  var ns=[next.getFullYear(),String(next.getMonth()+1).padStart(2,'0'),String(next.getDate()).padStart(2,'0')].join('');
  return base
    +'&text='+encodeURIComponent(ev.title)
    +'&dates='+ds+'/'+ns
    +'&details='+encodeURIComponent(ev.description+(ev.link?'\n\nMore info: '+ev.link:''))
    +'&location='+encodeURIComponent((ev.venue||'')+(ev.address?', '+ev.address:''));
}

function shareEvent(ev){
  var text=ev.title+' — '+ev.venue+', '+(ev.city||'Bay Area')+' ('+ev.date+')';
  var url='https://blackbeards-music-library.pages.dev/events';
  if(navigator.share){
    navigator.share({title:ev.title,text:text,url:url}).catch(function(){});
  } else {
    navigator.clipboard.writeText(text+' '+url).then(function(){
      var btn=document.querySelector('[data-share="'+ev.title.replace(/"/g,'')+'"]');
      if(btn){var orig=btn.textContent;btn.textContent='Copied!';setTimeout(function(){btn.textContent=orig;},1800);}
    });
  }
}

function cardHTML(ev){
  var d=parseLocalDate(ev.date);
  var today=new Date();today.setHours(0,0,0,0);
  var isPast=d<today;
  var meta=[ev.time,ev.venue].filter(Boolean).join(' · ');
  var badge=ev.genre?'<span class="event-badge">'+ev.genre+'</span>':'';
  var infoLink=ev.link?'<a class="event-link-btn" href="'+ev.link+'" target="_blank" rel="noopener">Info ↗</a>':'';
  var calDropdown=!isPast?
    '<div class="cal-dropdown">'+
      '<button class="event-action-btn cal-trigger" aria-label="Add to calendar">📅 Save</button>'+
      '<div class="cal-menu">'+
        '<a href="'+gcalURL(ev)+'" target="_blank" rel="noopener">Google Calendar</a>'+
        '<a href="#" class="ics-download" data-title="'+encodeURIComponent(ev.title)+'">Apple / iCal</a>'+
      '</div>'+
    '</div>':'';
  var shareBtn='<button class="event-action-btn" data-share="'+ev.title.replace(/"/g,'&quot;')+'" onclick="window.__shareEv&&window.__shareEv(''+ev.title.replace(/'/g,"\'")+'')">🔗 Share</button>';
  return '<div class="event-card anim-entry'+(isPast?' past'  :'')+'" data-evtitle="'+ev.title.replace(/"/g,'&quot;')+'">'+
    '<div class="event-date-block">'+
      '<div class="event-month">'+MONTHS[d.getMonth()]+'</div>'+
      '<div class="event-day">'+d.getDate()+'</div>'+
      '<div class="event-weekday">'+DAYS[d.getDay()]+'</div>'+
    '</div>'+
    '<div class="event-info">'+
      '<div class="event-title">'+ev.title+'</div>'+
      '<div class="event-meta">'+meta+'</div>'+
      '<div class="event-desc">'+ev.description+'</div>'+
      '<div class="event-actions">'+calDropdown+shareBtn+infoLink+'</div>'+
    '</div>'+
    '<div class="event-right">'+badge+'</div>'+
  '</div>';
}

function render(){
  var filtered=filterEvents();
  countEl.textContent=filtered.length===allEvents.length?filtered.length+' events':filtered.length+' of '+allEvents.length+' events';
  clearBtn.classList.toggle('visible',isFiltered());
  if(!filtered.length){
    root.innerHTML='<div class="events-empty"><span class="skull">☠️</span><p>No shows match those filters.<br>Try broadening your search.</p></div>';
    return;
  }
  var html='';
  if(activeCity!=='all'||searchQuery){
    filtered.sort(function(a,b){return parseLocalDate(a.date)-parseLocalDate(b.date);});
    html='<div class="events-list">'+filtered.map(cardHTML).join('')+'</div>';
  } else {
    var byCiy={};
    CITY_ORDER.forEach(function(c){byCiy[c]=[];});
    filtered.forEach(function(ev){if(byCiy[ev.city])byCiy[ev.city].push(ev);});
    CITY_ORDER.forEach(function(city){
      var evs=byCiy[city];if(!evs.length)return;
      evs.sort(function(a,b){return parseLocalDate(a.date)-parseLocalDate(b.date);});
      html+='<div class="geo-section">'+
        '<div class="geo-header">'+
          '<div class="geo-title">'+(CITY_LABELS[city]||city)+'</div>'+
          '<span class="geo-count">'+evs.length+'</span>'+
          '<div class="geo-line"></div>'+
        '</div>'+
        '<div class="events-list">'+evs.map(cardHTML).join('')+'</div>'+
      '</div>';
    });
  }
  root.innerHTML=html;

  // Wire up ICS downloads and share buttons
  root.querySelectorAll('.ics-download').forEach(function(a){
    a.addEventListener('click',function(e){
      e.preventDefault();
      var title=decodeURIComponent(a.dataset.title);
      var ev=allEvents.find(function(x){return x.title===title;});
      if(!ev)return;
      var ics=makeICS(ev);
      var blob=new Blob([ics],{type:'text/calendar'});
      var url=URL.createObjectURL(blob);
      var tmp=document.createElement('a');
      tmp.href=url;tmp.download=title.replace(/[^a-z0-9]/gi,'-').toLowerCase()+'.ics';
      tmp.click();URL.revokeObjectURL(url);
    });
  });

  // Cal dropdown toggles
  root.querySelectorAll('.cal-trigger').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var menu=btn.nextElementSibling;
      var open=menu.classList.contains('open');
      document.querySelectorAll('.cal-menu.open').forEach(function(m){m.classList.remove('open');});
      if(!open)menu.classList.add('open');
    });
  });
  document.addEventListener('click',function(){
    document.querySelectorAll('.cal-menu.open').forEach(function(m){m.classList.remove('open');});
  });

  // Share wiring
  window.__shareEv=function(title){
    var ev=allEvents.find(function(x){return x.title===title;});
    if(ev)shareEvent(ev);
  };

  requestAnimationFrame(function(){
    var cards=document.querySelectorAll('.event-card.anim-entry');
    cards.forEach(function(c,i){setTimeout(function(){c.classList.add('visible');},i*50);});
  });
}

function buildCityPills(cities){
  var all=['all'].concat(CITY_ORDER.filter(function(c){return cities.has(c);}));
  cityPills.innerHTML=all.map(function(c){return '<button class="pill'+(c===activeCity?' active':'')+'" data-city="'+c+'">'+(c==='all'?'All':(CITY_LABELS[c]||c))+'</button>';}).join('');
  cityPills.querySelectorAll('.pill').forEach(function(btn){btn.addEventListener('click',function(){activeCity=btn.dataset.city;cityPills.querySelectorAll('.pill').forEach(function(b){b.classList.toggle('active',b.dataset.city===activeCity);});render();});});
}

function buildGenrePills(genres){
  var sorted=['all'].concat(Array.from(genres).sort());
  genrePills.innerHTML=sorted.map(function(g){return '<button class="pill'+(g===activeGenre?' active':'')+'" data-genre="'+g+'">'+(g==='all'?'All':g)+'</button>';}).join('');
  genrePills.querySelectorAll('.pill').forEach(function(btn){btn.addEventListener('click',function(){activeGenre=btn.dataset.genre;genrePills.querySelectorAll('.pill').forEach(function(b){b.classList.toggle('active',b.dataset.genre===activeGenre);});render();});});
}

function init(){
  root=document.getElementById('events-root');
  countEl=document.getElementById('results-count');
  clearBtn=document.getElementById('clear-btn');
  searchEl=document.getElementById('events-search');
  cityPills=document.getElementById('city-pills');
  genrePills=document.getElementById('genre-pills');
  whenPills=document.getElementById('when-pills');

  whenPills.querySelectorAll('.pill').forEach(function(btn){btn.addEventListener('click',function(){activeWhen=btn.dataset.when;whenPills.querySelectorAll('.pill').forEach(function(b){b.classList.toggle('active',b.dataset.when===activeWhen);});render();});});

  var searchTimer;
  searchEl.addEventListener('input',function(e){clearTimeout(searchTimer);searchTimer=setTimeout(function(){searchQuery=e.target.value.trim();render();},120);});

  clearBtn.addEventListener('click',function(){
    activeCity='all';activeGenre='all';activeWhen='all';searchQuery='';searchEl.value='';
    cityPills.querySelectorAll('.pill').forEach(function(b){b.classList.toggle('active',b.dataset.city==='all');});
    genrePills.querySelectorAll('.pill').forEach(function(b){b.classList.toggle('active',b.dataset.genre==='all');});
    whenPills.querySelectorAll('.pill').forEach(function(b){b.classList.toggle('active',b.dataset.when==='all');});
    render();
  });

  fetch('events.json')
    .then(function(r){return r.json();})
    .then(function(data){
      allEvents=data.sort(function(a,b){return parseLocalDate(a.date)-parseLocalDate(b.date);});
      buildCityPills(new Set(data.map(function(e){return e.city;})));
      buildGenrePills(new Set(data.map(function(e){return e.genre;}).filter(Boolean)));
      render();
    })
    .catch(function(){root.innerHTML='<div class="events-empty"><span class="skull">⚓</span><p>Could not load events. Try refreshing.</p></div>';});
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();