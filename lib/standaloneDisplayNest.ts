/**
 * Standalone HTML document for /display/nest — no React, no App Router page.
 * Served by app/display/nest/route.ts (GET).
 */

export function getStandaloneDisplayNestHtml(basePath: string): string {
  const bp = basePath.replace(/\/+$/, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>DenBoard Display</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    background:#000;
    color:#e2e8f0;
    -webkit-font-smoothing:antialiased;
    overflow:hidden;
  }
  #wrap{
    width:100vw;height:100vh;
    display:flex;align-items:center;justify-content:center;
    background:#000;
  }
  #stage{
    width:min(100vw, calc(100vh * 16 / 9));
    height:min(100vh, calc(100vw * 9 / 16));
    aspect-ratio:16/9;
    max-width:100vw;max-height:100vh;
    background:#0f172a;
    display:flex;flex-direction:column;
    padding:clamp(4px,0.8vmin,10px) clamp(4px,1vmin,12px);
    overflow:hidden;
  }
  .top{
    flex:0 0 72%;
    display:flex;flex-direction:column;
    min-height:0;
  }
  .row{
    flex:3;
    display:flex;flex-direction:row;
    align-items:stretch;
    justify-content:center;
    gap:clamp(6px,1.5vmin,14px);
    min-height:0;
  }
  .clock-wrap{
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
  }
  #clock{
    font-weight:800;
    font-variant-numeric:tabular-nums;
    line-height:1;
    font-size:clamp(40px, min(11vw, 12vh), 140px);
    color:#f8fafc;
  }
  .weather{
    display:flex;flex-direction:column;
    justify-content:center;
    align-items:flex-start;
    min-width:0;
    max-width:11rem;
    flex:0 1 auto;
  }
  #w-icon{font-size:clamp(18px,5vw,40px);line-height:1}
  #w-temp{font-weight:700;font-variant-numeric:tabular-nums;font-size:clamp(14px,4.5vw,32px);color:#f8fafc}
  #w-text{font-size:clamp(8px,2.5vw,13px);color:#94a3b8;line-height:1.25;max-width:12rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .date-row{
    flex:1;
    display:flex;align-items:center;justify-content:center;
    text-align:center;
    color:#94a3b8;
    font-size:clamp(9px,2.8vw,16px);
    min-height:0;
    padding:2px 4px;
  }
  #events{
    flex:1 1 auto;
    min-height:0;
    overflow-y:auto;
    overflow-x:hidden;
    padding:4px 2px 6px;
  }
  #events ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
  #events li{
    display:flex;align-items:baseline;gap:8px;
    padding:8px 10px;border-radius:12px;
    font-size:clamp(10px,2.2vw,15px);
    color:#f1f5f9;
    min-width:0;
  }
  .ev-time{
    flex-shrink:0;
    font-variant-numeric:tabular-nums;
    color:#94a3b8;
    min-width:3.5ch;
    font-size:0.92em;
  }
  .ev-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
  #status{font-size:10px;color:#64748b;text-align:center;padding:2px 4px 0;flex-shrink:0}
</style>
</head>
<body>
<div id="wrap">
  <div id="stage">
    <div class="top">
      <div class="row">
        <div class="clock-wrap"><div id="clock">–:––</div></div>
        <div class="weather">
          <span id="w-icon">⛰</span>
          <span id="w-temp">–°</span>
          <span id="w-text"></span>
        </div>
      </div>
      <div class="date-row" id="date"></div>
    </div>
    <div id="events"><ul id="ev-list"></ul></div>
    <div id="status"></div>
  </div>
</div>
<script>
(function(){
"use strict";
var BASE=${JSON.stringify(bp)};
function api(p){return(BASE||"")+p;}
function log(msg,err){
  if(err)console.error("[DenBoard display] "+msg,err);
  else console.log("[DenBoard display] "+msg);
}
var COLORS=["#3B82F6","#F59E0B","#22C55E","#EF4444"];
function eventColor(evt,i){
  if(evt&&evt.calendarColor)return evt.calendarColor;
  return COLORS[i%COLORS.length];
}
function weatherIcon(code){
  if(code==null)return"⛰";
  var k=typeof code==="string"?code.toLowerCase():"";
  if(["rain","rainy","pouring"].indexOf(k)>=0)return"🌧";
  if(["snow","snowy"].indexOf(k)>=0)return"🌨";
  if(["storm","lightning","lightning-rainy"].indexOf(k)>=0)return"⛈";
  if(["cloudy","overcast","partlycloudy","partly cloudy"].indexOf(k)>=0)return"☁️";
  if(["clear","sunny"].indexOf(k)>=0)return"☀️";
  if(k==="clear-night")return"🌙";
  var n=typeof code==="number"?code:parseInt(String(code),10);
  if(!isFinite(n))return"⛰";
  if(n===0)return"☀️";
  if([1,2,3].indexOf(n)>=0)return"🌤";
  if([45,48].indexOf(n)>=0)return"☁️";
  if([51,53,55,61,63,65,80,81,82].indexOf(n)>=0)return"🌧";
  if([71,73,75,77,85,86].indexOf(n)>=0)return"🌨";
  if([95,96,99].indexOf(n)>=0)return"⛈";
  return"⛰";
}
function fmtTemp(t,units){
  if(t==null||typeof t!=="number"||isNaN(t))return"–°";
  return Math.round(t)+(units==="metric"?"℃":"°");
}
function fmtClock(d){
  var h=d.getHours(),m=d.getMinutes();
  var h12=h%12;if(h12===0)h12=12;
  return h12+":"+(m<10?"0":"")+m;
}
function fmtEventTime(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime()))return"";
  return fmtClock(d);
}
function buildRows(cal,guest){
  if(guest||!cal||!cal.today)return[];
  var allDay=cal.today.allDay||[];
  var timed=(cal.today.timed||[]).slice().sort(function(a,b){
    return new Date(a.start)-new Date(b.start);
  });
  var rows=[],i;
  for(i=0;i<allDay.length;i++)rows.push({evt:allDay[i],time:null});
  for(i=0;i<timed.length;i++)rows.push({evt:timed[i],time:fmtEventTime(timed[i].start)});
  return rows;
}
var clockEl=document.getElementById("clock");
var dateEl=document.getElementById("date");
var wIcon=document.getElementById("w-icon");
var wTemp=document.getElementById("w-temp");
var wText=document.getElementById("w-text");
var evList=document.getElementById("ev-list");
var statusEl=document.getElementById("status");
function tickClock(){
  var n=new Date();
  clockEl.textContent=fmtClock(n);
  try{
    dateEl.textContent=n.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  }catch(e){
    dateEl.textContent=n.toDateString();
  }
}
function renderWeather(w){
  if(!w){
    wIcon.textContent="⛰";
    wTemp.textContent="–°";
    wText.textContent="";
    return;
  }
  wIcon.textContent=weatherIcon(w.conditionCode);
  wTemp.textContent=fmtTemp(w.temperatureCurrent,w.units);
  wText.textContent=w.conditionText||"";
}
function renderEvents(rows){
  while(evList.firstChild)evList.removeChild(evList.firstChild);
  var i,r,li,t1,t2,title;
  for(i=0;i<rows.length;i++){
    r=rows[i];
    li=document.createElement("li");
    t1=document.createElement("span");
    t1.className="ev-time";
    t1.textContent=r.time!=null&&r.time!==""?r.time:"\u00a0";
    t2=document.createElement("span");
    t2.className="ev-title";
    title=(r.evt&&r.evt.title)?String(r.evt.title):"";
    t2.textContent=title;
    t2.title=title;
    var c=eventColor(r.evt,i);
    if(typeof c==="string"&&c.charAt(0)==="#")li.style.backgroundColor=c+"25";
    else li.style.backgroundColor="rgba(59,130,246,0.15)";
    li.style.borderLeft="3px solid "+c;
    li.appendChild(t1);
    li.appendChild(t2);
    evList.appendChild(li);
  }
}
function loadAll(){
  var guest=false;
  var weather=null;
  var calendar=null;
  var p1=fetch(api("/api/home-assistant"),{cache:"no-store",credentials:"omit"})
    .then(function(res){
      if(res.ok)return res.json();
      log("home-assistant http "+res.status);
      return null;
    })
    .then(function(ha){
      if(ha&&typeof ha.guestMode==="boolean")guest=ha.guestMode;
      if(ha)log("home-assistant ok");else log("home-assistant skipped");
    })
    .catch(function(e){log("home-assistant failed",e);});
  var p2=fetch(api("/api/weather"),{cache:"no-store",credentials:"omit"})
    .then(function(res){
      if(res.ok)return res.json();
      log("weather http "+res.status);
      return null;
    })
    .then(function(w){weather=w;if(w)log("weather ok");})
    .catch(function(e){log("weather failed",e);});
  var tz="";
  try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"";}catch(e1){}
  var params=new URLSearchParams();
  if(tz)params.set("tz",tz);
  params.set("now",new Date().toISOString());
  var p3=fetch(api("/api/calendar?")+params.toString(),{cache:"no-store",credentials:"omit"})
    .then(function(res){
      if(res.ok)return res.json();
      log("calendar http "+res.status);
      return null;
    })
    .then(function(c){calendar=c;if(c)log("calendar ok");})
    .catch(function(e){log("calendar failed",e);});
  return Promise.all([p1,p2,p3]).then(function(){
    renderWeather(weather);
    renderEvents(buildRows(calendar,guest));
    statusEl.textContent="";
    log("data refresh complete");
  }).catch(function(e){
    log("loadAll error",e);
    statusEl.textContent="Some data failed to load";
  });
}
function boot(){
  log("page boot");
  tickClock();
  setInterval(tickClock,1000);
  loadAll();
  setInterval(function(){
    log("scheduled full reload (60s)");
    window.location.reload();
  },60000);
}
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",boot);
}else boot();
})();
<\/script>
</body>
</html>`;
}
