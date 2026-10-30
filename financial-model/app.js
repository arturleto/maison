'use strict';
const d=window.MODEL_INPUTS,$=id=>document.getElementById(id),fmt=n=>Math.round(n/d.rate).toLocaleString('ru-RU'),money=n=>fmt(n)+' $';
const MON=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'],MON_IN=['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
const MON_G=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const monthIn=m=>MON_IN[+m.slice(5)-1]+' '+m.slice(0,4),monthG=m=>MON_G[+m.slice(5)-1]+' '+m.slice(0,4),short=m=>MON[+m.slice(5)-1].slice(0,3);
const POS=[0,50,100,150],NAMES={0:'Пессимистичный',50:'Реалистичный',100:'Оптимистичный',150:'Сверхрезультат'},KEY={0:'pes',50:'std',100:'opt',150:'max'};
const people=n=>{const r=Math.round(n),m=r%10,h=r%100;return r+' '+((h>=11&&h<=14)?'человек':m===1?'человек':(m>=2&&m<=4)?'человека':'человек')+' в день';};
const S=Object.fromEntries(POS.map(p=>[p,simulateMaison(d,p)]));
const opened=new Set(['investor','funnel']),openYears=new Set();let current,columns,pos=50,TAX=0;const taxLabel=()=>TAX?' после налога '+Math.round(TAX*100)+'%':'';
const netPaid=r=>r.paid-r.profitPaid*TAX,netProfit=r=>r.profitPaid*(1-TAX),totalNet=b=>b.totalPaid-b.profitPaid*TAX;
const sum=(xs,f)=>xs.reduce((s,x)=>s+f(x),0),leaf=(id,label,fn,kind='flow')=>({id,label,fn,kind}),group=(id,label,children,cls='')=>({id,label,children,fn:r=>sum(children,x=>x.fn(r)),kind:'flow',cls});
const item=(bucket,key)=>r=>(r[bucket]||{})[key]||0,G=d.costs.groups;
const makeItems=(names,bucket,prefix)=>names.map((k,i)=>leaf(prefix+i,k,item(bucket,k)));
const team=group('team','Команда и охрана',[...makeItems(G.team,'fixedItems','staff'),...makeItems(G.teamAnnual,'annualItems','thr')]);
const space=group('space','Помещение, события и обслуживание',[...makeItems(G.space,'fixedItems','space'),...makeItems(G.spaceAnnual,'annualItems','maint')]);
const admin=group('admin','Учёт и сервисы',[...makeItems(G.admin,'fixedItems','admin'),...makeItems(G.adminAnnual,'annualItems','report')]);
const marketing=group('marketing','Реклама · 1 000 $ таргет, со ступени B доля продаж',[leaf('target','Таргет в Instagram · 1 000 $ в месяц',r=>r.adTarget),leaf('adRest','Бюджет ступени: 3%, 5%, 6% продаж сверх таргета',r=>r.adRest)]);
const sales=group('sales','Комиссии, партнёры, налоги и расходники',makeItems(G.sales,'variableItems','variable'));
const mgmt=leaf('mgmt','Управленческий фонд',item('variableItems',d.costs.mgmtName));
const costs=group('costs','Расходы на работу',[team,mgmt,space,admin,marketing,sales]);
const purchases=group('purchases','Покупки, розыгрыши и запуск ступеней',[...[...new Set(d.oneOff.map(x=>x.what))].map((w,i)=>leaf('purchase'+i,w,item('oneOffItems',w))),...makeItems(G.stageOneOff,'oneOffItems','stageBuy')]);
const taxLeaf=leaf('taxHeld','Удержанный налог с дохода инвестора',r=>-r.profitPaid*TAX),netLeaf={...leaf('netPaid','Инвестору на руки',netPaid),cls:'key'};
const investor=group('investor','Выплаты инвестору',[leaf('principalPaid','Возврат вложения',r=>r.principalPaid),leaf('profitPaid','Доход сверх вложения',r=>r.profitPaid)],'investor');
const live=rs=>rs.filter(r=>r.revenue>0),buys=rs=>sum(live(rs),r=>r.offline/r.check);
const one=v=>v.toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}),whole=v=>Math.round(v).toLocaleString('ru-RU');
const perDay=(rs,f)=>{const l=live(rs),n=sum(l,r=>r.days);return n?sum(l,r=>f(r)*r.days)/n:0;};
const CH_LABEL={base:'Как прошлой зимой · 8,8 в день, с учётом сезона',street:'Улица и район · вход, вывеска, свет, листовки',mailing:'Рассылка по базе 19 000 и CRM',bloggers:'Блогеры по бартеру и контент',events:'Маркеты и события второго этажа · со ступени B',coffee:'Кофе-уголок · со ступени B',partners:'Партнёрки 10% · со ступени C'};
const funnel={id:'funnel',label:'Посетителей в день · прошлой зимой 8,8, в октябре 2026 3,8',agg:rs=>perDay(rs,r=>r.visitors),show:one,cls:'funnel',children:[
 ...d.channels.map(c=>({id:'ch_'+c.id,label:CH_LABEL[c.id]||c.name,agg:rs=>perDay(rs,r=>r.ch[c.id]||0),show:one})),
 {id:'vAds',label:'',agg:rs=>perDay(rs,r=>r.adVisitors),show:one},
 {id:'conversion',label:'Из них покупают · 44% до 20 человек в день, выше меньше',agg:rs=>perDay(rs,r=>r.conversion),show:v=>one(v*100)+'%'},
 {id:'purchases',label:'Покупок в магазине за период',agg:buys,show:whole},
 {id:'avgCheck',label:'Средний чек, $',agg:rs=>{const b=buys(rs);return b?sum(live(rs),r=>r.offline)/b:0;},show:fmt},
 {id:'stage',label:'Ступень на конец периода · A старт, B, C, D',agg:rs=>live(rs).length?live(rs).at(-1).stage:'',show:v=>v}]};
const revenue=group('revenue','Продажи',[leaf('offline','В магазине',r=>r.offline),leaf('online','Онлайн: сайт, маркетплейсы, WhatsApp',r=>r.online)]);
const tree=[funnel,revenue,leaf('brands','Брендам · 55%, с 2028 года 50%',r=>r.revenue-r.store+r.floor),
 {...group('store','Доход магазина',[leaf('storeComm','Комиссия магазина · 45%, с 2028 года 50%',r=>r.store-r.floor),leaf('floor','Второй этаж: рейлы, события, кофе-партнёр · со ступени B',r=>r.floor)]),cls:'key'},costs,purchases,
 {...leaf('flow','Результат до аренды · аренда оплачена вперёд',r=>r.flow),cls:'key'},leaf('investment','Вложение инвестора',r=>r.investment),
 group('old','Аренда по графику и старый долг брендам',[leaf('rent','Аренда, последний платёж 01.04.2027',r=>r.rent),leaf('debt','Долг брендам, гасим в первый месяц',r=>r.debt)]),
 investor,taxLeaf,netLeaf,leaf('owed','Начислено инвестору, ждёт выплаты',r=>r.owed,'stock'),leaf('cumPaid','Инвестор получил с начала',r=>r.cumPaid,'stock'),leaf('capital','Осталось вернуть инвестору',r=>r.capital,'stock'),
 {id:'liquidity',label:'Деньги на счёте',fn:r=>r.cash,kind:'stock',children:[leaf('rentRemaining','Из них отложено на аренду',r=>r.rentRemaining,'stock'),leaf('allocated','Из них ближайшая выплата инвестору',r=>r.allocated,'stock'),leaf('reserve','Из них резерв, месяц постоянных расходов',r=>r.reserve,'stock'),leaf('free','Свободно сверх резерва',r=>r.freeCash-r.reserve,'stock')]}];
function visible(nodes=tree,level=0){return nodes.flatMap(n=>[{...n,level},...(n.children&&opened.has(n.id)?visible(n.children,level+1):[])]);}
function allGroups(nodes=tree){return nodes.flatMap(n=>n.children?[n.id,...allGroups(n.children)]:[]);}
function columnValue(n,c){return n.agg?n.agg(c.rows):n.kind==='stock'?n.fn(c.rows.at(-1)):sum(c.rows,n.fn);}
function cell(n,c){if(n.agg&&!live(c.rows).length)return '';const v=columnValue(n,c);if(typeof v==='string')return v;return Math.abs(v)<.01?'0':(n.show||fmt)(v);}
function buildColumns(){columns=[];for(const year of ['2026','2027','2028','2029','2030']){const rows=current.rows.filter(r=>r.month.startsWith(year));columns.push({key:year,label:year,rows,year:true,sub:year==='2026'?'декабрь':year==='2030'?'янв-июль':'12 месяцев'});if(openYears.has(year))for(const r of rows)columns.push({key:r.month,label:short(r.month),rows:[r],sub:r.month==='2030-07'?'расчёт':'',year:false});}columns.push({key:'total',label:'Весь срок',rows:current.rows,sub:'дек 2026-июль 2030'});}
function renderTable(){buildColumns();$('tableHead').innerHTML='<tr><th scope="col">Статья / период</th>'+columns.map(c=>'<th scope="col">'+(c.year?'<button data-year="'+c.key+'" aria-expanded="'+openYears.has(c.key)+'">'+(openYears.has(c.key)?'− ':'+ ')+c.label+'</button>':c.label)+'<small>'+c.sub+'</small></th>').join('')+'</tr>';
 $('tableBody').innerHTML=visible().map(n=>'<tr class="level'+n.level+' '+(n.cls||'')+' '+(n.kind==='stock'?'stock':'')+'"><th scope="row">'+(n.children?'<button class="row-label" data-row="'+n.id+'" aria-expanded="'+opened.has(n.id)+'"><span class="toggle">'+(opened.has(n.id)?'−':'+')+'</span>'+n.label+'</button>':n.label)+'</th>'+columns.map(c=>{const v=n.agg?0:columnValue(n,c);return '<td class="'+(v<-.5*d.rate?'negative':'')+'">'+cell(n,c)+'</td>';}).join('')+'</tr>').join('');
 document.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{const y=b.dataset.year;openYears.has(y)?openYears.delete(y):openYears.add(y);renderTable();});document.querySelectorAll('[data-row]').forEach(b=>b.onclick=()=>{const k=b.dataset.row;opened.has(k)?opened.delete(k):opened.add(k);renderTable();});
 $('years').classList.toggle('active',openYears.size===0);$('months').classList.toggle('active',openYears.size===5);
}
function cardsHtml(){return POS.map(p=>{const b=S[p],ok=b.unreturned<.5*d.rate;
 const line2=ok?'Вложение возвращается в '+monthIn(b.returned):'Вложение возвращается не полностью';
 const line3=ok?'Сверх вложения '+money(b.profitPaid*(1-TAX))+taxLabel():'Не хватает '+money(b.unreturned);
 const y28=b.rows.filter(r=>r.month.startsWith('2028')),v28=y28.reduce((s,r)=>s+r.visitors*r.days,0)/y28.reduce((s,r)=>s+r.days,0);
 return '<button class="sc'+(p===pos?' active':'')+(p===150?' max':'')+'" data-pos="'+p+'" aria-pressed="'+(p===pos)+'"><span class="sc-name">'+NAMES[p]+' · '+people(v28)+(p===150?' <em>гипотеза</em>':'')+'</span><small class="sc-level">'+d.levels[KEY[p]]+'</small><span class="sc-label">Вложил '+money(d.investment)+', получит всего'+(TAX?' на руки':'')+'</span><strong>'+money(totalNet(b))+'</strong><span class="sc-line">'+line2+'</span><span class="sc-line">'+line3+'</span></button>';}).join('');}
function chart(){const rows=current.rows,n=rows.length,W=660,H=150,L=48,R=14,T=12,B=26,top=Math.ceil(Math.max(d.investment,current.totalPaid,S[100].totalPaid)/d.rate/50000)*50000*d.rate;
 const x=i=>L+i*(W-L-R)/(n-1),y=v=>T+(H-T-B)*(1-v/top);let g='';
 for(let v=0;v<=top+1;v+=50000*d.rate)g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v).toFixed(1)+'" y2="'+y(v).toFixed(1)+'" stroke="#dce0d4"/><text x="'+(L-6)+'" y="'+(y(v)+3).toFixed(1)+'" text-anchor="end">'+(v/d.rate/1000)+'k $</text>';
 rows.forEach((r,i)=>{if(r.month.endsWith('-01'))g+='<line x1="'+x(i).toFixed(1)+'" x2="'+x(i).toFixed(1)+'" y1="'+T+'" y2="'+(H-B)+'" stroke="#e6e9df"/><text x="'+x(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+r.month.slice(0,4)+'</text>';});
 let cum=0;const path=rows.map((r,i)=>{cum+=netPaid(r);return (i?'L':'M')+x(i).toFixed(1)+','+y(Math.min(cum,top)).toFixed(1);}).join(' ');
 let mark='';let acc=0;const ri=TAX?rows.findIndex(r=>(acc+=netPaid(r))>=d.investment-.5*d.rate):rows.findIndex(r=>r.month===current.returned);if(ri>=0)mark='<circle cx="'+x(ri).toFixed(1)+'" cy="'+y(d.investment).toFixed(1)+'" r="5" fill="#365f49"/><text class="mk" x="'+x(ri).toFixed(1)+'" y="'+(y(d.investment)-9).toFixed(1)+'" text-anchor="'+(ri>n*.7?'end':'middle')+'">возврат в '+monthIn(rows[ri].month)+'</text>';
 $('chart').innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Сколько инвестор получил с начала, по месяцам, относительно вложения '+money(d.investment)+'">'+g+'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(d.investment).toFixed(1)+'" y2="'+y(d.investment).toFixed(1)+'" stroke="#b38a4a" stroke-dasharray="5 4"/><text class="gold" x="'+(W-R)+'" y="'+(y(d.investment)+13).toFixed(1)+'" text-anchor="end">вложение '+money(d.investment)+'</text><path d="'+path+'" stroke="#365f49" stroke-width="2.5" fill="none"/>'+mark+'</svg>';}
function status(){const b=current;let t;
 if(b.unreturned>.5*d.rate)t='Инвестор получает '+money(b.totalPaid)+' из '+money(d.investment)+', в том числе '+money(b.settlement)+' при окончательном расчёте в июле 2030. Не хватает '+money(b.unreturned)+'.';
 else t='Вложение возвращается в '+monthIn(b.returned)+'. Всего инвестор получает '+money(totalNet(b))+(TAX?' на руки после налога '+Math.round(TAX*100)+'%, удержано '+money(b.profitPaid*TAX):'')+', из них '+money(b.profitPaid*(1-TAX))+' сверх вложения'+(b.settlement>.5*d.rate?', в том числе '+money(b.settlement)+' при окончательном расчёте в июле 2030':'')+'.';
 const st=['B','C','D'].filter(s=>b.stageFrom[s]).map(s=>s+' с '+monthG(b.stageFrom[s])).join(', ');
 t+=' За 2027 год выплаты '+money(b.rows.filter(r=>r.month.startsWith('2027')).reduce((s,r)=>s+netPaid(r),0))+(TAX?' на руки':'')+'. Ступени: '+(st||'только старт, расходы на рост не включаются')+'. Самый низкий свободный остаток '+money(b.minimumFree)+', из него резерв '+money(d.minimumCash)+'.';
 if(b.extraFunding>0)t+=' Не хватает денег на работу: '+money(b.extraFunding)+'.';$('status').textContent=t;}
function render(){current=S[pos];funnel.children.find(x=>x.id==='vAds').label='От рекламы · первая 1 000 $ даёт +'+d.ads.per1000[KEY[pos]]+' человека в день, дальше меньше';$('cards').innerHTML=cardsHtml();document.querySelectorAll('.sc').forEach(b=>b.onclick=()=>{pos=+b.dataset.pos;render();});
 $('tableHelp').textContent='Таблица расчёта «'+NAMES[pos]+'». Суммы в $, кроме строк о посетителях. Нажмите на год, чтобы увидеть месяцы, и на строку с «+», чтобы увидеть состав.';
 status();chart();renderTable();}
$('years').onclick=()=>{openYears.clear();renderTable();};$('months').onclick=()=>{['2026','2027','2028','2029','2030'].forEach(y=>openYears.add(y));renderTable();};$('expand').onclick=()=>{allGroups().forEach(k=>opened.add(k));renderTable();};$('collapse').onclick=()=>{opened.clear();openYears.clear();renderTable();};
document.querySelectorAll('.tx').forEach(b=>b.onclick=()=>{TAX=+b.dataset.tax;document.querySelectorAll('.tx').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});taxLeaf.label='Удержанный налог с дохода инвестора'+(TAX?' · '+Math.round(TAX*100)+'%':'');render();});
document.querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>{pos=+b.dataset.show;render();$('cards').scrollIntoView({behavior:'smooth',block:'start'});});
$('csv').onclick=()=>{const quote=x=>'"'+String(x).replaceAll('"','""')+'"';const lines=[['Расчёт',NAMES[pos]],['Все суммы USD; остатки на конец периода'],['Статья',...columns.map(c=>c.key)],...visible().map(n=>[n.label,...columns.map(c=>{const v=columnValue(n,c);return typeof v==='string'?v:(v/(n.show&&n.show!==fmt?1:d.rate)).toFixed(2).replace('.',',');})])];const url=URL.createObjectURL(new Blob(['﻿'+lines.map(row=>row.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='maison-financial-model-'+KEY[pos]+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();
