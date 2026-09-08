
const KEYS={clients:'pg-tracker-clients-v3',logs:'pg-tracker-logs-v3',payments:'pg-tracker-payments-v3',tasks:'pg-tracker-tasks-v3',invoices:'pg-tracker-invoices-v3'};
const OLD_CLIENT='pg-tracker-clients-v2',OLD_LOG='pg-tracker-logs-v2';
const CLOUD={url:'pg-tracker-cloud-url',token:'pg-tracker-cloud-token',auto:'pg-tracker-cloud-auto',last:'pg-tracker-cloud-last'};
let cloudTimer=null,cloudBusy=false;
const $=id=>document.getElementById(id),uid=()=>crypto.randomUUID();
let clients=[],logs=[],payments=[],tasks=[],invoices=[],calCursor=new Date();

function localDate(d){const x=d||new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}
function money(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtDate(v){if(!v)return '—';return new Date(v+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}
function fmtTime(v){if(!v)return '—';const p=v.split(':').map(Number);return new Date(2000,0,1,p[0],p[1]).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
function client(id){return clients.find(c=>c.id===id)}
function calcTime(a,b,breakMin){if(!a||!b)return 0;const x=a.split(':').map(Number),y=b.split(':').map(Number);let s=x[0]*60+x[1],e=y[0]*60+y[1];if(e<s)e+=1440;return Math.max(0,(e-s-(Number(breakMin)||0))/60)}
function hours(l){if(l.manualHours!==''&&l.manualHours!==null&&l.manualHours!==undefined&&!Number.isNaN(Number(l.manualHours)))return Number(l.manualHours);return calcTime(l.timeIn,l.timeOut,l.breakMin)}
function earned(l){if(l.billAmount!==''&&l.billAmount!==null&&l.billAmount!==undefined&&!Number.isNaN(Number(l.billAmount)))return Number(l.billAmount);const c=client(l.clientId),h=hours(l),r=c?Number(c.rate)||0:0,ot=Math.min(h,Math.max(0,Number(l.overtimeHours)||0)),otr=c?(Number(c.overtimeRate)||r*1.5):r*1.5;return (h-ot)*r+ot*otr}
function weekStartDate(){const d=new Date();const day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return localDate(d)}
function inPeriod(d,p){if(p==='all')return true;if(p==='today')return d===localDate();if(p==='week')return d>=weekStartDate()&&d<=localDate();if(p==='month')return d.slice(0,7)===localDate().slice(0,7);if(p==='year')return d.slice(0,4)===localDate().slice(0,4);return true}
function logsForClient(cid){return logs.filter(l=>l.clientId===cid)}
function totalBilled(cid){return logsForClient(cid).reduce((a,l)=>a+earned(l),0)}
function totalPaid(cid){return payments.filter(p=>p.clientId===cid).reduce((a,p)=>a+Number(p.amount||0),0)}
function balance(cid){return Math.max(0,totalBilled(cid)-totalPaid(cid))}
function todayHours(cid){return logs.filter(l=>l.clientId===cid&&l.date===localDate()).reduce((a,l)=>a+hours(l),0)}
function weekHours(cid){return logs.filter(l=>l.clientId===cid&&inPeriod(l.date,'week')).reduce((a,l)=>a+hours(l),0)}
function openLogFor(cid){return logs.find(l=>l.clientId===cid&&l.date===localDate()&&l.timeIn&&!l.timeOut)}
function saveLocalData(){localStorage.setItem(KEYS.clients,JSON.stringify(clients));localStorage.setItem(KEYS.logs,JSON.stringify(logs));localStorage.setItem(KEYS.payments,JSON.stringify(payments));localStorage.setItem(KEYS.tasks,JSON.stringify(tasks));localStorage.setItem(KEYS.invoices,JSON.stringify(invoices))}
function persist(opts){saveLocalData();render();if(!(opts&&opts.cloud===false))scheduleCloudPush()}

function loadData(){
 try{clients=JSON.parse(localStorage.getItem(KEYS.clients))||[];logs=JSON.parse(localStorage.getItem(KEYS.logs))||[];payments=JSON.parse(localStorage.getItem(KEYS.payments))||[];tasks=JSON.parse(localStorage.getItem(KEYS.tasks))||[];invoices=JSON.parse(localStorage.getItem(KEYS.invoices))||[]}catch(e){}
 if(!clients.length){
   let oc=[],ol=[];try{oc=JSON.parse(localStorage.getItem(OLD_CLIENT))||[];ol=JSON.parse(localStorage.getItem(OLD_LOG))||[]}catch(e){}
   if(oc.length){
     clients=oc.map(c=>({id:c.id||uid(),company:c.company||'',contact:c.contact||'',billingType:'hourly',rate:Number(c.rate)||0,fixedRate:0,method:c.method||'',schedule:c.schedule||'',nextPay:c.nextPay||'',weeklyTarget:Number(c.expectedHours||0)*5||0,overtimeRate:Number(c.overtimeRate)||0,status:c.status||'active',notes:c.notes||''}));
     logs=ol.map(l=>({id:l.id||uid(),clientId:l.clientId,date:l.date||localDate(),timeIn:l.timeIn||'',timeOut:l.timeOut||'',breakMin:Number(l.breakMin)||0,manualHours:l.manualHours??'',billAmount:'',task:l.task||'',createdAt:l.createdAt||Date.now()}));
     ol.filter(l=>l.paid==='paid').forEach(l=>{const c=clients.find(x=>x.id===l.clientId);const amt=(l.manualHours!==''?Number(l.manualHours):calcTime(l.timeIn,l.timeOut,l.breakMin))*(c?Number(c.rate)||0:0);if(amt>0)payments.push({id:uid(),clientId:l.clientId,date:l.paidDate||l.date||localDate(),amount:amt,method:c?.method||'',reference:'Migrated paid work',notes:'Imported from previous tracker'})});
   }else{
     clients=[
       {id:uid(),company:'Merch Cartel / Apparelology',contact:'Tony',billingType:'hourly',rate:5,fixedRate:0,method:'',schedule:'',nextPay:'',weeklyTarget:20,overtimeRate:0,status:'active',notes:''},
       {id:uid(),company:'Digital Sea Creative',contact:'Brandon',billingType:'hourly',rate:0,fixedRate:0,method:'',schedule:'',nextPay:'',weeklyTarget:0,overtimeRate:0,status:'active',notes:''}
     ];
   }
   persist();
 }
}
function render(){
 const today=logs.filter(l=>inPeriod(l.date,'today')),week=logs.filter(l=>inPeriod(l.date,'week')),month=logs.filter(l=>inPeriod(l.date,'month')),year=logs.filter(l=>inPeriod(l.date,'year'));
 $('mHours').textContent=today.reduce((a,l)=>a+hours(l),0).toFixed(2);
 $('mToday').textContent=money(today.reduce((a,l)=>a+earned(l),0));
 $('mWeek').textContent=money(week.reduce((a,l)=>a+earned(l),0));
 $('mMonth').textContent=money(month.reduce((a,l)=>a+earned(l),0));
 $('mYear').textContent=money(year.reduce((a,l)=>a+earned(l),0));
 $('mUnpaid').textContent=money(clients.reduce((a,c)=>a+balance(c.id),0));
 renderOverview();renderClients();renderClock();renderLogs();renderCalendar();renderTasks();renderPayments();renderInvoices();renderAnalytics();populateSelects();
}

function renderOverview(){
 const active=clients.filter(c=>c.status==='active');
 $('overviewTargets').innerHTML=active.length?active.map(c=>{const h=weekHours(c.id),t=Number(c.weeklyTarget)||0,p=t?Math.min(100,h/t*100):0;return '<div class="item"><strong>'+esc(c.company)+'</strong><p>'+h.toFixed(2)+' / '+(t?t.toFixed(2):'—')+' weekly hours</p><div class="progress"><span style="width:'+p+'%"></span></div></div>'}).join(''):'<div class="empty">No active clients.</div>';
 const due=tasks.filter(t=>t.status!=='done').sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999')).slice(0,6);
 $('overviewTasks').innerHTML=due.length?due.map(t=>{const c=client(t.clientId);return '<div class="item"><strong>'+esc(t.title)+'</strong><p>'+esc(c?.company||'No client')+' • '+esc(t.status)+' • '+(t.deadline?fmtDate(t.deadline):'No deadline')+'</p></div>'}).join(''):'<div class="empty">No open tasks.</div>';
 const next=clients.filter(c=>c.nextPay).sort((a,b)=>a.nextPay.localeCompare(b.nextPay)).slice(0,5);
 $('overviewPay').innerHTML=next.length?next.map(c=>'<div class="item"><strong>'+esc(c.company)+'</strong><p>'+fmtDate(c.nextPay)+' • Balance '+money(balance(c.id))+'</p></div>').join(''):'<div class="empty">No payment dates set.</div>';
}

function renderClients(){
 const q=$('clientSearch').value.toLowerCase().trim();
 const arr=clients.filter(c=>(c.company+' '+c.contact+' '+c.method).toLowerCase().includes(q));
 $('clientRows').innerHTML=arr.length?arr.map(c=>{
   const h=weekHours(c.id),t=Number(c.weeklyTarget)||0,p=t?Math.min(100,h/t*100):0;
   const rate=c.billingType==='fixed'?(money(c.fixedRate)+' project'):money(c.rate)+'/hr'+(c.overtimeRate?' • OT '+money(c.overtimeRate)+'/hr':'');
   return '<tr><td><div class="company">'+esc(c.company)+'</div><div class="smallmuted">'+esc(c.contact||'No contact')+'</div></td><td>'+esc(c.billingType||'hourly')+'<div class="smallmuted">'+rate+'</div></td><td>'+esc(c.method||'Not set')+'</td><td>'+esc(c.schedule||'Not set')+(c.nextPay?'<div class="smallmuted">Next: '+fmtDate(c.nextPay)+'</div>':'')+'</td><td>'+h.toFixed(2)+(t?' / '+t.toFixed(2):'')+' hrs<div class="progress"><span style="width:'+p+'%"></span></div></td><td class="money">'+money(balance(c.id))+'</td><td><span class="pill '+c.status+'">'+esc(c.status)+'</span></td><td><div class="row-actions"><button class="btn small green" onclick="newWork(\''+c.id+'\')">Log Work</button><button class="btn small" onclick="editClient(\''+c.id+'\')">Edit</button><button class="btn small red" onclick="deleteClient(\''+c.id+'\')">Delete</button></div></td></tr>';
 }).join(''):'<tr><td colspan="8" class="empty">No clients found.</td></tr>';
}
function renderClock(){
 const arr=clients.filter(c=>c.status==='active');
 $('clockList').innerHTML=arr.length?arr.map(c=>{const o=openLogFor(c.id);return '<div class="item"><strong>'+esc(c.company)+'</strong><p class="clock">'+(o?'Clocked in '+fmtTime(o.timeIn):'Not clocked in')+' • Today '+todayHours(c.id).toFixed(2)+' hrs</p><div class="row-actions" style="margin-top:8px">'+(o?'<button class="btn small green" onclick="clockOut(\''+c.id+'\')">Clock Out</button>':'<button class="btn small primary" onclick="clockIn(\''+c.id+'\')">Clock In</button>')+'<button class="btn small" onclick="newWork(\''+c.id+'\')">Manual Log</button></div></div>'}).join(''):'<div class="empty">No active clients.</div>';
}
function renderLogs(){
 const p=$('logPeriod').value,q=$('logSearch').value.toLowerCase().trim();
 const arr=logs.filter(l=>inPeriod(l.date,p)).filter(l=>{const c=client(l.clientId);return((c?.company||'')+' '+l.task).toLowerCase().includes(q)}).sort((a,b)=>(b.date+(b.timeIn||'')).localeCompare(a.date+(a.timeIn||'')));
 $('logRows').innerHTML=arr.length?arr.map(l=>{const c=client(l.clientId);return '<tr><td>'+fmtDate(l.date)+'</td><td><div class="company">'+esc(c?.company||'Deleted client')+'</div></td><td>'+fmtTime(l.timeIn)+' → '+fmtTime(l.timeOut)+(l.timeIn&&!l.timeOut?'<div class="smallmuted"><span class="pill open">Open</span></div>':'')+'</td><td>'+Number(l.breakMin||0)+' min</td><td>'+hours(l).toFixed(2)+(Number(l.overtimeHours)>0?'<div class="smallmuted">OT '+Number(l.overtimeHours).toFixed(2)+' hrs</div>':'')+'</td><td>'+esc(l.task||'—')+'</td><td class="money">'+money(earned(l))+'</td><td><div class="row-actions"><button class="btn small" onclick="editWork(\''+l.id+'\')">Edit</button><button class="btn small red" onclick="deleteWork(\''+l.id+'\')">Delete</button></div></td></tr>'}).join(''):'<tr><td colspan="8" class="empty">No work logs for this period.</td></tr>';
}

function renderCalendar(){
 const y=calCursor.getFullYear(),m=calCursor.getMonth();$('calTitle').textContent=calCursor.toLocaleDateString('en-US',{month:'long',year:'numeric'});
 const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());
 let out='';
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const ds=localDate(d),same=d.getMonth()===m,ls=logs.filter(l=>l.date===ds),h=ls.reduce((a,l)=>a+hours(l),0),e=ls.reduce((a,l)=>a+earned(l),0);out+='<div class="day '+(!same?'out ':'')+(ds===localDate()?'today':'')+'" onclick="showDay(\''+ds+'\')"><div class="num">'+d.getDate()+'</div>'+(h?'<div class="cal-hours">'+h.toFixed(2)+' hrs</div><div class="cal-money">'+money(e)+'</div>':'')+'</div>'}
 $('calendarGrid').innerHTML=out;
}
function showDay(ds){const arr=logs.filter(l=>l.date===ds);$('dayTitle').textContent='Work on '+fmtDate(ds);$('dayDetails').innerHTML=arr.length?arr.map(l=>{const c=client(l.clientId);return '<div class="item"><strong>'+esc(c?.company||'Client')+'</strong><p>'+fmtTime(l.timeIn)+' → '+fmtTime(l.timeOut)+' • '+hours(l).toFixed(2)+' hrs • '+money(earned(l))+'<br>'+esc(l.task||'')+'</p></div>'}).join(''):'<div class="empty">No work logged.</div>';$('dayDialog').showModal()}

function renderTasks(){
 const q=$('taskSearch').value.toLowerCase().trim(),st=$('taskFilter').value;
 const arr=tasks.filter(t=>st==='all'||t.status===st).filter(t=>{const c=client(t.clientId);return(t.title+' '+t.notes+' '+(c?.company||'')).toLowerCase().includes(q)}).sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999'));
 $('taskRows').innerHTML=arr.length?arr.map(t=>{const c=client(t.clientId);return '<tr><td><div class="company">'+esc(t.title)+'</div><div class="smallmuted">'+esc(t.notes||'')+'</div></td><td>'+esc(c?.company||'—')+'</td><td><span class="pill '+t.status+'">'+esc(t.status)+'</span></td><td>'+esc(t.priority||'normal')+'</td><td>'+fmtDate(t.deadline)+'</td><td><div class="row-actions"><button class="btn small" onclick="editTask(\''+t.id+'\')">Edit</button><button class="btn small green" onclick="completeTask(\''+t.id+'\')">Done</button><button class="btn small red" onclick="deleteTask(\''+t.id+'\')">Delete</button></div></td></tr>'}).join(''):'<tr><td colspan="6" class="empty">No tasks found.</td></tr>';
}

function renderPayments(){
 const rows=clients.map(c=>({c,b:balance(c.id),paid:totalPaid(c.id)})).filter(x=>x.b>0||x.paid>0);
 $('paymentRows').innerHTML=rows.length?rows.map(x=>'<tr><td><div class="company">'+esc(x.c.company)+'</div></td><td class="money">'+money(totalBilled(x.c.id))+'</td><td>'+money(x.paid)+'</td><td class="money">'+money(x.b)+'</td><td>'+esc(x.c.method||'Not set')+'</td><td>'+fmtDate(x.c.nextPay)+'</td><td><button class="btn small green" onclick="newPayment(\''+x.c.id+'\')">Add Payment</button></td></tr>').join(''):'<tr><td colspan="7" class="empty">No billing activity yet.</td></tr>';
 const arr=payments.slice().sort((a,b)=>b.date.localeCompare(a.date));
 $('ledgerRows').innerHTML=arr.length?arr.map(p=>{const c=client(p.clientId);return '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(c?.company||'Deleted client')+'</td><td class="money">'+money(p.amount)+'</td><td>'+esc(p.method||'—')+'</td><td>'+esc(p.reference||'—')+'</td><td>'+esc(p.notes||'—')+'</td><td><div class="row-actions"><button class="btn small" onclick="editPayment(\''+p.id+'\')">Edit</button><button class="btn small red" onclick="deletePayment(\''+p.id+'\')">Delete</button></div></td></tr>'}).join(''):'<tr><td colspan="7" class="empty">No payments recorded.</td></tr>';
}

function renderInvoices(){
 const arr=invoices.slice().sort((a,b)=>b.createdAt-a.createdAt);
 $('invoiceRows').innerHTML=arr.length?arr.map(i=>{const c=client(i.clientId);return '<tr><td>'+esc(i.number)+'</td><td>'+esc(c?.company||'Client')+'</td><td>'+fmtDate(i.start)+' – '+fmtDate(i.end)+'</td><td>'+fmtDate(i.dueDate)+'</td><td class="money">'+money(i.amount)+'</td><td><span class="pill '+i.status+'">'+esc(i.status)+'</span></td><td><div class="row-actions"><button class="btn small" onclick="downloadInvoice(\''+i.id+'\')">Download</button><button class="btn small green" onclick="markInvoicePaid(\''+i.id+'\')">Paid</button><button class="btn small red" onclick="deleteInvoice(\''+i.id+'\')">Delete</button></div></td></tr>'}).join(''):'<tr><td colspan="7" class="empty">No invoices created.</td></tr>';
}

function renderAnalytics(){
 const months=[];const now=new Date();
 for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');months.push({key,label:d.toLocaleDateString('en-US',{month:'short'}),value:logs.filter(l=>l.date.slice(0,7)===key).reduce((a,l)=>a+earned(l),0)})}
 const max=Math.max(1,...months.map(x=>x.value));$('monthChart').innerHTML=months.map(x=>'<div class="bar-wrap"><div class="bar-value">'+money(x.value)+'</div><div class="bar" style="height:'+(x.value/max*170)+'px"></div><div class="bar-label">'+x.label+'</div></div>').join('');
 const byClient=clients.map(c=>({name:c.company,value:totalBilled(c.id)})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);const cm=Math.max(1,...byClient.map(x=>x.value));$('clientChart').innerHTML=byClient.length?byClient.map(x=>'<div class="bar-wrap"><div class="bar-value">'+money(x.value)+'</div><div class="bar" style="height:'+(x.value/cm*170)+'px"></div><div class="bar-label">'+esc(x.name.slice(0,12))+'</div></div>').join(''):'<div class="empty">No earnings yet.</div>';
 const y=localDate().slice(0,4),yearLogs=logs.filter(l=>l.date.startsWith(y));$('analyticsSummary').innerHTML='<div class="summary-line"><span>Total billed this year</span><strong>'+money(yearLogs.reduce((a,l)=>a+earned(l),0))+'</strong></div><div class="summary-line"><span>Total payments received</span><strong>'+money(payments.filter(p=>p.date.startsWith(y)).reduce((a,p)=>a+Number(p.amount||0),0))+'</strong></div><div class="summary-line"><span>Total hours this year</span><strong>'+yearLogs.reduce((a,l)=>a+hours(l),0).toFixed(2)+'</strong></div><div class="summary-line"><span>Outstanding balance</span><strong>'+money(clients.reduce((a,c)=>a+balance(c.id),0))+'</strong></div>';
}

function populateSelects(){
 const opts=clients.map(c=>'<option value="'+c.id+'">'+esc(c.company)+'</option>').join('');
 ['wClient','tClient','pClient','iClient'].forEach(id=>{const el=$(id),cur=el.value;el.innerHTML=opts;if(clients.some(c=>c.id===cur))el.value=cur});
}

function resetClient(){['cId','cCompany','cContact','cMethod','cSchedule','cNextPay','cWeeklyTarget','cNotes','cRate','cFixedRate','cOvertimeRate'].forEach(id=>$(id).value='');$('cBilling').value='hourly';$('cStatus').value='active';toggleBilling()}
function toggleBilling(){const fixed=$('cBilling').value==='fixed';$('hourlyField').classList.toggle('hidden',fixed);$('fixedField').classList.toggle('hidden',!fixed)}
function editClient(id){const c=client(id);if(!c)return;resetClient();$('clientTitle').textContent='Edit Client';$('cId').value=c.id;$('cCompany').value=c.company;$('cContact').value=c.contact||'';$('cBilling').value=c.billingType||'hourly';$('cRate').value=c.rate||0;$('cFixedRate').value=c.fixedRate||0;$('cOvertimeRate').value=c.overtimeRate||'';$('cMethod').value=c.method||'';$('cSchedule').value=c.schedule||'';$('cNextPay').value=c.nextPay||'';$('cWeeklyTarget').value=c.weeklyTarget||'';$('cStatus').value=c.status||'active';$('cNotes').value=c.notes||'';toggleBilling();$('clientDialog').showModal()}
function deleteClient(id){if(confirm('Delete this client? Work, tasks and payment history remain for backup purposes.')){clients=clients.filter(c=>c.id!==id);persist()}}

function resetWork(){['wId','wIn','wOut','wManual','wBill','wTask'].forEach(id=>$(id).value='');$('wDate').value=localDate();$('wBreak').value=0;$('wOvertime').value=0;syncWorkCalc()}
function newWork(cid){resetWork();populateSelects();if(cid)$('wClient').value=cid;prefillBill();$('workTitle').textContent='Log Work';$('workDialog').showModal()}
function editWork(id){const l=logs.find(x=>x.id===id);if(!l)return;resetWork();populateSelects();$('workTitle').textContent='Edit Work Log';$('wId').value=l.id;$('wClient').value=l.clientId;$('wDate').value=l.date;$('wIn').value=l.timeIn||'';$('wOut').value=l.timeOut||'';$('wBreak').value=l.breakMin||0;$('wOvertime').value=l.overtimeHours||0;$('wManual').value=l.manualHours??'';$('wBill').value=l.billAmount??'';$('wTask').value=l.task||'';syncWorkCalc();$('workDialog').showModal()}
function prefillBill(){const c=client($('wClient').value);if(c?.billingType==='fixed'&&$('wBill').value==='')$('wBill').value=c.fixedRate||'';syncWorkCalc()}
function syncWorkCalc(){const h=$('wManual').value!==''?Number($('wManual').value)||0:calcTime($('wIn').value,$('wOut').value,$('wBreak').value);const c=client($('wClient').value);const r=c?Number(c.rate)||0:0,ot=Math.min(h,Math.max(0,Number($('wOvertime').value)||0)),otr=c?(Number(c.overtimeRate)||r*1.5):r*1.5;const amt=$('wBill').value!==''?Number($('wBill').value)||0:(h-ot)*r+ot*otr;$('wCalculated').textContent=h.toFixed(2)+' hours • '+money(amt)}
function deleteWork(id){if(confirm('Delete this work log?')){logs=logs.filter(l=>l.id!==id);persist()}}

function clockIn(cid){if(openLogFor(cid))return;const n=new Date();logs.push({id:uid(),clientId:cid,date:localDate(n),timeIn:String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'),timeOut:'',breakMin:0,manualHours:'',billAmount:'',task:'Work session',createdAt:Date.now()});persist()}
function clockOut(cid){const l=openLogFor(cid);if(!l)return;const n=new Date();l.timeOut=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');if(l.task==='Work session')l.task='Work session — add details';persist();editWork(l.id)}

function resetTask(){['tId','tTitle','tDeadline','tNotes'].forEach(id=>$(id).value='');$('tStatus').value='todo';$('tPriority').value='normal'}
function editTask(id){const t=tasks.find(x=>x.id===id);if(!t)return;resetTask();populateSelects();$('taskTitle').textContent='Edit Task';$('tId').value=t.id;$('tClient').value=t.clientId||'';$('tTitle').value=t.title;$('tStatus').value=t.status;$('tPriority').value=t.priority;$('tDeadline').value=t.deadline||'';$('tNotes').value=t.notes||'';$('taskDialog').showModal()}
function completeTask(id){const t=tasks.find(x=>x.id===id);if(t){t.status='done';persist()}}
function deleteTask(id){if(confirm('Delete this task?')){tasks=tasks.filter(t=>t.id!==id);persist()}}

function resetPayment(){['pId','pDate','pAmount','pMethod','pReference','pNotes'].forEach(id=>$(id).value='');$('pDate').value=localDate()}
function newPayment(cid){resetPayment();populateSelects();if(cid)$('pClient').value=cid;const c=client($('pClient').value);$('pAmount').value=balance($('pClient').value).toFixed(2);$('pMethod').value=c?.method||'';$('paymentTitle').textContent='Record Payment';$('paymentDialog').showModal()}
function editPayment(id){const p=payments.find(x=>x.id===id);if(!p)return;resetPayment();populateSelects();$('paymentTitle').textContent='Edit Payment';$('pId').value=p.id;$('pClient').value=p.clientId;$('pDate').value=p.date;$('pAmount').value=p.amount;$('pMethod').value=p.method||'';$('pReference').value=p.reference||'';$('pNotes').value=p.notes||'';$('paymentDialog').showModal()}
function deletePayment(id){if(confirm('Delete this payment record?')){payments=payments.filter(p=>p.id!==id);persist()}}

function resetInvoice(){['iId','iNumber','iStart','iEnd','iDue','iNotes'].forEach(id=>$(id).value='');$('iNumber').value='INV-'+new Date().getFullYear()+'-'+String(invoices.length+1).padStart(3,'0');$('iEnd').value=localDate();const s=new Date();s.setDate(1);$('iStart').value=localDate(s);const d=new Date();d.setDate(d.getDate()+7);$('iDue').value=localDate(d);syncInvoicePreview()}
function invoiceCalc(cid,start,end){const ls=logs.filter(l=>l.clientId===cid&&l.date>=start&&l.date<=end);return {logs:ls,hours:ls.reduce((a,l)=>a+hours(l),0),amount:ls.reduce((a,l)=>a+earned(l),0)}}
function syncInvoicePreview(){const r=invoiceCalc($('iClient').value,$('iStart').value||'0000',$('iEnd').value||'9999');$('invoicePreview').textContent=r.hours.toFixed(2)+' hours • '+money(r.amount)}
function downloadInvoice(id){const i=invoices.find(x=>x.id===id);if(!i)return;const c=client(i.clientId),r=invoiceCalc(i.clientId,i.start,i.end);let body='INVOICE '+i.number+'\n\nClient: '+(c?.company||'')+'\nContact: '+(c?.contact||'')+'\nPeriod: '+fmtDate(i.start)+' - '+fmtDate(i.end)+'\nDue: '+fmtDate(i.dueDate)+'\n\nHours: '+r.hours.toFixed(2)+'\nAmount Due: '+money(i.amount)+'\nPayment Method: '+(c?.method||'')+'\n\nNotes: '+(i.notes||'')+'\n';download(i.number+'.txt',body,'text/plain')}
function markInvoicePaid(id){const i=invoices.find(x=>x.id===id);if(!i)return;i.status='paid';if(!payments.some(p=>p.invoiceId===id)){const cl=client(i.clientId);payments.push({id:uid(),invoiceId:id,clientId:i.clientId,date:localDate(),amount:Number(i.amount)||0,method:cl?.method||'',reference:i.number,notes:'Payment recorded from paid invoice'})}persist()}
function deleteInvoice(id){if(confirm('Delete this invoice?')){invoices=invoices.filter(i=>i.id!==id);persist()}}


function cloudConfig(){return{url:(localStorage.getItem(CLOUD.url)||'').trim(),token:(localStorage.getItem(CLOUD.token)||'').trim(),auto:localStorage.getItem(CLOUD.auto)==='1'}}
function cloudConfigured(){const c=cloudConfig();return /^https:\/\/script\.google\.com\//.test(c.url)&&!!c.token}
function cloudAutoEnabled(){return cloudConfig().auto}
function setCloudStatus(msg,type){const el=$('cloudStatus');if(!el)return;el.textContent=msg;el.className='notice'+(type==='ok'?' success':'')}
function loadCloudUi(){const c=cloudConfig();if($('cloudUrl'))$('cloudUrl').value=c.url;if($('cloudToken'))$('cloudToken').value=c.token;if($('cloudAuto'))$('cloudAuto').checked=c.auto;setCloudStatus(cloudConfigured()?(c.auto?'Google Sheets connected • automatic sync ON':'Google Sheets connection saved • automatic sync OFF'):'Cloud sync is not configured on this browser yet.',cloudConfigured()?'ok':'')}
function saveCloudConfig(){const url=$('cloudUrl').value.trim(),token=$('cloudToken').value.trim(),auto=$('cloudAuto').checked;localStorage.setItem(CLOUD.url,url);localStorage.setItem(CLOUD.token,token);localStorage.setItem(CLOUD.auto,auto?'1':'0');loadCloudUi();if(cloudConfigured())cloudPing()}
function cloudPayload(){return{clients,logs,payments,tasks,invoices}}
function deviceLabel(){return (navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||'browser'}
function scheduleCloudPush(){if(!cloudAutoEnabled()||!cloudConfigured()||cloudBusy)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>cloudPush(true),700)}
function cloudJsonp(action){return new Promise((resolve,reject)=>{if(!cloudConfigured())return reject(new Error('Cloud connection is not configured.'));const cfg=cloudConfig(),cb='pgCloudCb_'+Date.now()+'_'+Math.random().toString(36).slice(2);const s=document.createElement('script'),timer=setTimeout(()=>done(new Error('Google Sheets request timed out.')),15000);function done(err,data){clearTimeout(timer);try{delete window[cb]}catch(e){};s.remove();err?reject(err):resolve(data)}window[cb]=data=>done(null,data);s.onerror=()=>done(new Error('Could not reach the Apps Script web app.'));s.src=cfg.url+'?action='+encodeURIComponent(action)+'&token='+encodeURIComponent(cfg.token)+'&callback='+encodeURIComponent(cb)+'&_='+Date.now();document.head.appendChild(s)})}
async function cloudPing(){try{setCloudStatus('Checking Google Sheets connection…');const r=await cloudJsonp('ping');if(!r||!r.ok)throw new Error(r&&r.error||'Connection failed');if(r.meta&&r.meta.lastModified)localStorage.setItem(CLOUD.last,r.meta.lastModified);setCloudStatus('Connected to Google Sheets • '+(r.meta&&r.meta.lastModified?'last cloud save '+r.meta.lastModified:'ready to sync'),'ok')}catch(e){setCloudStatus('Google Sheets connection failed: '+e.message)}}
async function cloudPull(showConfirm=true){if(!cloudConfigured()){setCloudStatus('Enter the Web App URL and API token first.');return}if(showConfirm&&!confirm('Replace this browser\'s current tracker data with the latest data from Google Sheets?'))return;try{cloudBusy=true;setCloudStatus('Pulling latest data from Google Sheets…');const r=await cloudJsonp('getAll');if(!r||!r.ok)throw new Error(r&&r.error||'Pull failed');const d=r.data||{};clients=d.clients||[];logs=d.logs||[];payments=d.payments||[];tasks=d.tasks||[];invoices=d.invoices||[];saveLocalData();render();if(r.meta&&r.meta.lastModified)localStorage.setItem(CLOUD.last,r.meta.lastModified);setCloudStatus('Pulled from Google Sheets successfully'+(r.meta&&r.meta.lastModified?' • '+r.meta.lastModified:''),'ok')}catch(e){setCloudStatus('Could not pull from Google Sheets: '+e.message)}finally{cloudBusy=false}}
function cloudPush(silent=false){if(!cloudConfigured()){if(!silent)setCloudStatus('Enter the Web App URL and API token first.');return}if(cloudBusy)return;cloudBusy=true;const cfg=cloudConfig();if(!silent)setCloudStatus('Saving tracker data to Google Sheets…');const iframeId='pgCloudFrame';let frame=$(iframeId);if(!frame){frame=document.createElement('iframe');frame.id=iframeId;frame.name=iframeId;frame.style.display='none';document.body.appendChild(frame)}const form=document.createElement('form');form.method='POST';form.action=cfg.url;form.target=iframeId;form.style.display='none';[['action','saveAll'],['token',cfg.token],['writer',deviceLabel()],['data',JSON.stringify(cloudPayload())]].forEach(([n,v])=>{const input=document.createElement('input');input.type='hidden';input.name=n;input.value=v;form.appendChild(input)});document.body.appendChild(form);form.submit();form.remove();setTimeout(async()=>{cloudBusy=false;try{const r=await cloudJsonp('ping');if(r&&r.ok){if(r.meta&&r.meta.lastModified)localStorage.setItem(CLOUD.last,r.meta.lastModified);setCloudStatus('Synced to Google Sheets'+(r.meta&&r.meta.lastModified?' • '+r.meta.lastModified:''),'ok')}else throw new Error(r&&r.error||'Save confirmation failed')}catch(e){setCloudStatus('Save was sent, but confirmation failed: '+e.message)}},1700)}

function download(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function backup(){download('philip-client-tracker-backup.json',JSON.stringify({version:3,clients,logs,payments,tasks,invoices,exportedAt:new Date().toISOString()},null,2),'application/json')}
function importBackup(file){const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(reader.result);if(!d.clients||!d.logs)throw new Error('Invalid backup');if(!confirm('Replace the tracker data in this browser with this backup?'))return;clients=d.clients||[];logs=d.logs||[];payments=d.payments||[];tasks=d.tasks||[];invoices=d.invoices||[];persist();alert('Backup imported successfully.')}catch(e){alert('Could not import this backup file.')}};reader.readAsText(file)}
function exportCsv(){const h=['Date','Company','Contact','Time In','Time Out','Break Minutes','Hours','Overtime Hours','Task','Billable USD'];const rows=logs.map(l=>{const c=client(l.clientId);return[l.date,c?.company||'',c?.contact||'',l.timeIn,l.timeOut,l.breakMin,hours(l),Number(l.overtimeHours)||0,l.task,earned(l)]});download('philip-work-logs.csv',[h,...rows].map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv')}

$('addClientBtn').onclick=()=>{resetClient();$('clientTitle').textContent='Add Client';$('clientDialog').showModal()};
$('cBilling').onchange=toggleBilling;
$('clientForm').onsubmit=e=>{e.preventDefault();const id=$('cId').value||uid(),obj={id,company:$('cCompany').value.trim(),contact:$('cContact').value.trim(),billingType:$('cBilling').value,rate:Number($('cRate').value)||0,fixedRate:Number($('cFixedRate').value)||0,method:$('cMethod').value.trim(),schedule:$('cSchedule').value.trim(),nextPay:$('cNextPay').value,weeklyTarget:Number($('cWeeklyTarget').value)||0,overtimeRate:Number($('cOvertimeRate').value)||0,status:$('cStatus').value,notes:$('cNotes').value.trim()};const i=clients.findIndex(c=>c.id===id);if(i>=0)clients[i]=obj;else clients.push(obj);persist();$('clientDialog').close()};
['wIn','wOut','wBreak','wOvertime','wManual','wBill'].forEach(id=>$(id).addEventListener('input',syncWorkCalc));$('wClient').addEventListener('change',prefillBill);
$('workForm').onsubmit=e=>{e.preventDefault();const id=$('wId').value||uid(),obj={id,clientId:$('wClient').value,date:$('wDate').value,timeIn:$('wIn').value,timeOut:$('wOut').value,breakMin:Number($('wBreak').value)||0,overtimeHours:Number($('wOvertime').value)||0,manualHours:$('wManual').value===''?'':Number($('wManual').value),billAmount:$('wBill').value===''?'':Number($('wBill').value),task:$('wTask').value.trim(),createdAt:Date.now()};const i=logs.findIndex(l=>l.id===id);if(i>=0)logs[i]=obj;else logs.push(obj);persist();$('workDialog').close()};
$('addTaskBtn').onclick=()=>{resetTask();populateSelects();$('taskTitle').textContent='Add Task';$('taskDialog').showModal()};
$('taskForm').onsubmit=e=>{e.preventDefault();const id=$('tId').value||uid(),obj={id,clientId:$('tClient').value,title:$('tTitle').value.trim(),status:$('tStatus').value,priority:$('tPriority').value,deadline:$('tDeadline').value,notes:$('tNotes').value.trim()};const i=tasks.findIndex(t=>t.id===id);if(i>=0)tasks[i]=obj;else tasks.push(obj);persist();$('taskDialog').close()};
$('addPaymentBtn').onclick=()=>newPayment();
$('paymentForm').onsubmit=e=>{e.preventDefault();const id=$('pId').value||uid(),obj={id,clientId:$('pClient').value,date:$('pDate').value,amount:Number($('pAmount').value)||0,method:$('pMethod').value.trim(),reference:$('pReference').value.trim(),notes:$('pNotes').value.trim()};const i=payments.findIndex(p=>p.id===id);if(i>=0)payments[i]=obj;else payments.push(obj);persist();$('paymentDialog').close()};
$('addInvoiceBtn').onclick=()=>{resetInvoice();populateSelects();syncInvoicePreview();$('invoiceDialog').showModal()};
['iClient','iStart','iEnd'].forEach(id=>$(id).addEventListener('input',syncInvoicePreview));
$('invoiceForm').onsubmit=e=>{e.preventDefault();const id=$('iId').value||uid(),r=invoiceCalc($('iClient').value,$('iStart').value,$('iEnd').value),obj={id,number:$('iNumber').value.trim(),clientId:$('iClient').value,start:$('iStart').value,end:$('iEnd').value,dueDate:$('iDue').value,amount:r.amount,status:'unpaid',notes:$('iNotes').value.trim(),createdAt:Date.now()};invoices.push(obj);persist();$('invoiceDialog').close()};

document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab).classList.add('active')});
$('clientSearch').oninput=renderClients;$('logSearch').oninput=renderLogs;$('logPeriod').onchange=renderLogs;$('taskSearch').oninput=renderTasks;$('taskFilter').onchange=renderTasks;
$('prevMonth').onclick=()=>{calCursor=new Date(calCursor.getFullYear(),calCursor.getMonth()-1,1);renderCalendar()};$('nextMonth').onclick=()=>{calCursor=new Date(calCursor.getFullYear(),calCursor.getMonth()+1,1);renderCalendar()};
$('backupBtn').onclick=backup;$('exportCsv').onclick=exportCsv;$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value=''};
$('saveCloudBtn').onclick=saveCloudConfig;$('pullCloudBtn').onclick=()=>cloudPull(true);$('pushCloudBtn').onclick=()=>cloudPush(false);$('cloudAuto').onchange=()=>{localStorage.setItem(CLOUD.auto,$('cloudAuto').checked?'1':'0');loadCloudUi()};
loadData();render();loadCloudUi();if(cloudAutoEnabled()&&cloudConfigured())setTimeout(()=>cloudPull(false),450);
