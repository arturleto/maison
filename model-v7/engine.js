(function(root){'use strict';
// Финансовая модель Maison Sauvage, версия 7 (30.10.2026). Четыре расчёта: 0 пессимистичный, 50 реалистичный, 100 оптимистичный, 150 «если 100 человек в день».
// Отличие от v6: управленческий фонд (управляющий и основатель) считается от продаж месяца во всех расчётах, с первого месяца, без привязки к возврату вложения.
// Доля растёт с продажами: d.mgmt.points = [[продажи $ в месяц, доля]], ниже первой точки 0, между точками доля меняется пропорционально, выше последней точки доля последней.
// Остальное как в v6: люди в день по каналам × доля купивших × чек, плюс онлайн и второй этаж; расходы ступенями A→B→C→D; деньги, налоги и защита инвестора как в v5.
const KEYS={0:'pes',50:'std',100:'opt',150:'max'};
function mgmtFund(d,revenue){if(!d.mgmt)return 0;const su=revenue/d.rate,pts=d.mgmt.points;if(su<pts[0][0])return 0;let rate=pts.at(-1)[1];
 for(let i=1;i<pts.length;i++){const[a,ra]=pts[i-1],[b,rb]=pts[i];if(su<=b){rate=ra+(rb-ra)*(su-a)/(b-a);break;}}return su*rate*d.rate;}
function simulate(d,position){
 const p=KEYS[+position]!==undefined?+position:50,k=KEYS[p],c=d.costs,check=d.checks[k];
 const sum=o=>Object.values(o).reduce((a,b)=>a+b,0),order=d.stages.order,sidx=s=>order.indexOf(s);
 const conv=v=>d.conv.base*Math.min(1,Math.pow(d.conv.knee/Math.max(v,1e-9),d.conv.power));
 // Фаза 1: воронка по месяцам. Ступень растёт, когда последние N месяцев продаж выше цели следующей ступени.
 const funnel=[];let stage=order[0],stageAt=0;const sales=[],since={};
 d.months.forEach((month,i)=>{
  const mo=+month.slice(5),year=month.slice(0,4),days=new Date(+year,mo,0).getDate(),season=d.seasonality[mo-1];
  const next=order[sidx(stage)+1];
  // следующая ступень: продажи n месяцев подряд выше цели и прошло не меньше dwell месяцев на текущей ступени
  if(next&&!d.stages.off.includes(k)&&sales.length>=d.stages.n&&i-stageAt>=d.stages.dwell&&sales.slice(-d.stages.n).every(s=>s>d.stages.goal[next])){stage=next;stageAt=i;}
  const stageOn=s=>sidx(stage)>=sidx(s);
  const ch={base:d.baseVisitors[i]};
  // канал набирает силу rampMonths месяцев с момента включения: новый канал первые месяцы слабее
  for(const x of d.channels){if(x.id==='base')continue;const on=x.from?month>=x.from:stageOn(x.stage);if(on&&!(x.id in since))since[x.id]=i;const str=on?Math.min(1,(i-since[x.id]+1)/d.rampMonths):0;ch[x.id]=on?x.yields[k]*str*(x.seasonal?season:1)*(x.firstHalf&&i===0?0.5:1):0;}
  const v0=sum(ch),adShare=d.ads.shareByStage[stage],per=d.ads.per1000[k],onShare=month>=d.online.from?d.online.share[k][stage]:0;
  let visitors=v0,ads=d.ads.target,offline=0,online=0,cr=conv(v0);
  // отдача рекламы убывает: 1 000 $ даёт per человек в день (решение), каждая следующая тысяча меньше (степень d.ads.power)
  for(let it=0;it<40;it++){const adV=Math.pow(ads/d.rate/1000,d.ads.power)*per;visitors=v0+adV;cr=conv(visitors);offline=visitors*days*cr*check;online=onShare*offline;ads=Math.max(adShare*(offline+online),d.ads.target);}
  const adVisitors=visitors-v0,floor=stageOn(d.floor.stage)?d.floor.byScenario[k]:0;
  const partnerRev=(ch.partners||0)*days*cr*check;
  sales.push(offline+online);
  funnel.push({month,days,season,stage,ch,visitors,adVisitors,conversion:cr,offline,online,sales:offline+online,floor,ads,partnerRev});
 });
 // Фаза 2: деньги, как в v5
 const yearRevenue={};funnel.forEach(f=>{const y=f.month.slice(0,4);yearRevenue[y]=(yearRevenue[y]||0)+f.sales+f.floor;});
 const rentSchedule=c.rent.filter(x=>x[0].slice(0,7)>=d.months[0]);
 let rentRemaining=rentSchedule.reduce((s,x)=>s+x[1],0),cash=0,carry=0,capital=d.investment,entitled=0,owedCap=0,owedProfit=0;
 let cumPaid=0,returned=null,pendCap=0,pendProfit=0,minFree=Infinity,taxYear='',ytdBase=0,ytdTax=0,prevStage=null;
 const rows=d.months.map((month,i)=>{
  const f=funnel[i],mo=+month.slice(5),year=month.slice(0,4),revenue=f.sales,commission=d.commissionFrom.filter(x=>month>=x.from).at(-1).value,store=revenue*commission+f.floor;
  const profitRegime=yearRevenue[year]>c.tax.threshold;
  if(year!==taxYear){taxYear=year;ytdBase=0;ytdTax=0;}
  const stageOn=s=>sidx(f.stage)>=sidx(s);
  const fixedItems={...c.monthly};
  for(const[name,v]of Object.entries(c.monthlyFrom)){if(v.only&&!v.only.includes(k))continue;if(v.stage&&!stageOn(v.stage))continue;if(v.from==='после_возврата'?returned!==null:!v.from||month>=v.from)fixedItems[name]=v.idr;}
  for(const s of order)if(stageOn(s)&&c.stageCosts[s])for(const[name,v]of Object.entries(c.stageCosts[s].monthly||{}))fixedItems[name]=v;
  const annualItems={};for(const x of c.annual)if(x.months.includes(mo)&&(!x.from||month>=x.from))annualItems[x.name]=x.idr/x.months.length;
  const variableItems={};for(const[name,v]of Object.entries(c.share))if(name!==c.adsName)variableItems[name]=v*revenue;
  if(profitRegime)variableItems[c.tax.turnoverName]=0;else variableItems[c.tax.turnoverName]=c.share[c.tax.turnoverName]*(revenue+f.floor);
  variableItems[c.bagsName]=f.offline/check*c.bagPerCheck;
  variableItems[c.adsName]=f.ads;
  if(f.partnerRev>0)variableItems[c.partnerName]=d.partnerFee*f.partnerRev;
  if(f.online>0)variableItems[c.onlineName]=d.online.fee*f.online;
  if(d.mgmt)variableItems[c.mgmtName]=mgmtFund(d,revenue);
  const oneOffItems={};for(const x of d.oneOff)if(x.month===month&&p>=(x.minPosition||0))oneOffItems[x.what]=x.idr;
  if(f.stage!==prevStage){for(const s of order)if(sidx(f.stage)>=sidx(s)&&(prevStage===null?false:sidx(prevStage)<sidx(s))&&c.stageCosts[s])for(const[name,v]of Object.entries(c.stageCosts[s].oneOff||{}))oneOffItems[name]=(oneOffItems[name]||0)+v;prevStage=f.stage;}
  const purchases=sum(oneOffItems),fixed=sum(fixedItems),annual=sum(annualItems);
  // налог на прибыль: 22% минус льгота 31E с результата с начала года, только в годы с оборотом выше порога
  const base=store-fixed-annual-sum(variableItems)-purchases;let profitTax=0;
  if(profitRegime){ytdBase+=base;const rate=yearRevenue[year]<=c.tax.reliefUpTo?c.tax.profitRate-c.tax.relief*c.tax.threshold/yearRevenue[year]:c.tax.profitRate;
   const due=rate*Math.max(0,ytdBase);profitTax=due-ytdTax;ytdTax=due;}
  variableItems[c.tax.profitName]=profitTax;
  const variable=sum(variableItems),operating=store-fixed-annual-variable,flow=operating-purchases;
  const rent=rentSchedule.filter(x=>x[0].slice(0,7)===month).reduce((s,x)=>s+x[1],0),debt=i===0?d.brandDebt:0,investment=i===0?d.investment:0;
  const principalPaid=pendCap,paid=pendCap+pendProfit;capital-=principalPaid;cumPaid+=paid;if(capital<.01&&returned===null)returned=month;
  rentRemaining-=rent;cash+=investment+flow-rent-debt-paid;
  const dist=Math.max(0,flow-carry);carry=Math.max(0,carry-flow);
  let capNew=0,profitNew=0;const capLeft=d.investment-entitled;
  if(capLeft>.01){capNew=Math.min(capLeft,dist*d.shareBefore);if(capLeft-capNew<.01)profitNew=(dist-capNew/d.shareBefore)*d.shareAfter;}
  else profitNew=dist*d.shareAfter;
  entitled+=capNew;owedCap+=capNew;owedProfit+=profitNew;
  const pend=Math.min(owedCap+owedProfit,Math.max(0,cash-rentRemaining-d.minimumCash));
  pendCap=Math.min(owedCap,pend);pendProfit=pend-pendCap;owedCap-=pendCap;owedProfit-=pendProfit;
  const freeCash=cash-rentRemaining-pend;minFree=Math.min(minFree,freeCash);
  return {month,revenue,offline:f.offline,online:f.online,floor:f.floor,commission,stage:f.stage,store,brands:revenue-store+f.floor,fixed,annual,variable,ads:f.ads,adTarget:d.ads.target,adRest:f.ads-d.ads.target,operating,purchases,flow,profitTax,profitRegime,rent,debt,investment,
   paid,principalPaid,profitPaid:paid-principalPaid,cumPaid,capital,allocated:pend,owed:owedCap+owedProfit,cash,freeCash,rentRemaining,reserve:d.minimumCash,
   days:f.days,visitors:f.visitors,adVisitors:f.adVisitors,ch:f.ch,conversion:f.conversion,check,fixedItems,annualItems,variableItems,oneOffItems};
 });
 // июль 2030: выплата за июнь и окончательный расчёт до finalMultiple вложения
 const lastPay=pendCap+pendProfit;capital-=pendCap;cash-=lastPay;
 const settle=Math.min(Math.max(0,cash),Math.max(capital+owedProfit,d.finalMultiple*d.investment-cumPaid-lastPay)),settleCap=Math.min(capital,settle);
 capital-=settleCap;cash-=settle;const finalPaid=lastPay+settle;cumPaid+=finalPaid;if(capital<.01&&returned===null)returned='2030-07';
 const last=rows.at(-1);
 rows.push({...Object.fromEntries(Object.entries(last).map(([k2,v])=>[k2,typeof v==='number'?0:typeof v==='object'?{}:v])),month:'2030-07',stage:last.stage,paid:finalPaid,
  principalPaid:pendCap+settleCap,profitPaid:finalPaid-pendCap-settleCap,settlement:settle,cumPaid,capital,owed:0,cash,freeCash:cash,reserve:0});
 const paidIn=y=>rows.filter(r=>r.month.startsWith(y)).reduce((s,r)=>s+r.paid,0);
 const stageFrom={};for(const f of funnel)if(!(f.stage in stageFrom))stageFrom[f.stage]=f.month;
 return {position:p,key:k,rows,returned,totalPaid:cumPaid,lastPayment:finalPaid,settlement:settle,unreturned:capital,profitPaid:rows.reduce((s,r)=>s+r.profitPaid,0),
  paid2027:paidIn('2027'),extraFunding:Math.max(0,-minFree),reserveShortfall:Math.max(0,d.minimumCash-minFree),minimumFree:minFree,yearRevenue,stageFrom};
}
simulate.KEYS=KEYS;simulate.mgmtFund=mgmtFund;
root.simulateMaison=simulate;if(typeof module!=='undefined')module.exports=simulate;
})(typeof window!=='undefined'?window:globalThis);
