(function(root){'use strict';
// Финансовая модель Maison Sauvage, версия 4 (28.10.2026). Три сценария: 0 пессимистичный, 50 реалистичный, 100 оптимистичный.
// Отличия от v3: доля рекламы и часть команды по сценарию, посетители в день с разбивкой (прошлая зима, реклама, другие действия),
// комиссия магазина по датам.
function simulate(d,position){
 const p=[0,50,100].includes(+position)?+position:50,k=p===0?'pes':p===50?'std':'opt',c=d.costs,check=d.checks[k],rpv=d.conversion*check;
 const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
 const revenueOf=(m,i)=>d.ramps[k][Math.min(i,d.ramps[k].length-1)]*d.seasonality[+m.slice(5)-1];
 const yearRevenue={};d.months.forEach((m,i)=>{const y=m.slice(0,4);yearRevenue[y]=(yearRevenue[y]||0)+revenueOf(m,i);});
 const rentSchedule=c.rent.filter(x=>x[0].slice(0,7)>=d.months[0]);
 let rentRemaining=rentSchedule.reduce((s,x)=>s+x[1],0),cash=0,carry=0,capital=d.investment,entitled=0,owedCap=0,owedProfit=0;
 let cumPaid=0,returned=null,pendCap=0,pendProfit=0,minFree=Infinity,taxYear='',ytdBase=0,ytdTax=0;
 const rows=d.months.map((month,i)=>{
  const mo=+month.slice(5),year=month.slice(0,4),revenue=revenueOf(month,i),commission=d.commissionFrom.filter(x=>month>=x.from).at(-1).value,store=revenue*commission;
  const profitRegime=yearRevenue[year]>c.tax.threshold;
  if(year!==taxYear){taxYear=year;ytdBase=0;ytdTax=0;}
  const fixedItems={...c.monthly};
  for(const[name,v]of Object.entries(c.monthlyFrom)){if(v.only&&!v.only.includes(k))continue;if(v.from==='после_возврата'?returned!==null:month>=v.from)fixedItems[name]=v.idr;}
  const annualItems={};for(const x of c.annual)if(x.months.includes(mo)&&(!x.from||month>=x.from))annualItems[x.name]=x.idr/x.months.length;
  const variableItems={};for(const[name,v]of Object.entries(c.share))variableItems[name]=(name===c.adsName?d.adShare[k]:v)*revenue;
  if(profitRegime)variableItems[c.tax.turnoverName]=0;
  variableItems[c.bagsName]=revenue/check*c.bagPerCheck;
  const adShare=variableItems[c.adsName],adTarget=d.targetMonthly,ads=Math.max(adShare,adTarget);variableItems[c.adsName]=ads; // доля продаж по сценарию, но не меньше таргета; таргет внутри
  const oneOffItems={};for(const x of d.oneOff)if(x.month===month&&p>=(x.minPosition||0))oneOffItems[x.what]=x.idr;
  const purchases=sum(oneOffItems),fixed=sum(fixedItems),annual=sum(annualItems);
  // налог на прибыль: 22% минус льгота 31E с результата с начала года (доход минус все расходы и покупки), только в годы с оборотом выше порога
  const base=store-fixed-annual-sum(variableItems)-purchases;let profitTax=0;
  if(profitRegime){ytdBase+=base;const rate=yearRevenue[year]<=c.tax.reliefUpTo?c.tax.profitRate-c.tax.relief*c.tax.threshold/yearRevenue[year]:c.tax.profitRate; // льгота 31E до 50 млрд оборота
   const due=rate*Math.max(0,ytdBase);profitTax=due-ytdTax;ytdTax=due;}
  variableItems[c.tax.profitName]=profitTax;
  const variable=sum(variableItems),operating=store-fixed-annual-variable,flow=operating-purchases;
  const rent=rentSchedule.filter(x=>x[0].slice(0,7)===month).reduce((s,x)=>s+x[1],0),debt=i===0?d.brandDebt:0,investment=i===0?d.investment:0;
  // посетители в день: из продаж через долю купивших и чек; реклама даёт visitorsPer1000 человек на каждую 1 000 $, остальное от прошлой зимы и других действий
  const days=new Date(+year,mo,0).getDate(),visitors=revenue/(days*rpv),adVisitors=ads/d.rate/1000*d.visitorsPer1000[k];
  const baseVisitors=Math.min(Math.max(0,visitors-adVisitors),d.baseVisitors[i]),otherVisitors=Math.max(0,visitors-baseVisitors-adVisitors);
  // выплата, начисленная в прошлом месяце
  const principalPaid=pendCap,paid=pendCap+pendProfit;capital-=principalPaid;cumPaid+=paid;if(capital<.01&&returned===null)returned=month;
  rentRemaining-=rent;cash+=investment+flow-rent-debt-paid;
  // распределяемый результат: результат месяца после покрытия прошлых убытков
  const dist=Math.max(0,flow-carry);carry=Math.max(0,carry-flow);
  let capNew=0,profitNew=0;const capLeft=d.investment-entitled;
  if(capLeft>.01){capNew=Math.min(capLeft,dist*d.shareBefore);if(capLeft-capNew<.01)profitNew=(dist-capNew/d.shareBefore)*d.shareAfter;}
  else profitNew=dist*d.shareAfter;
  entitled+=capNew;owedCap+=capNew;owedProfit+=profitNew;
  // платим в следующем месяце, сколько позволяют деньги сверх аренды по графику и резерва; остальное переносится
  const pend=Math.min(owedCap+owedProfit,Math.max(0,cash-rentRemaining-d.minimumCash));
  pendCap=Math.min(owedCap,pend);pendProfit=pend-pendCap;owedCap-=pendCap;owedProfit-=pendProfit;
  const freeCash=cash-rentRemaining-pend;minFree=Math.min(minFree,freeCash);
  return {month,revenue,commission,store,brands:revenue-store,fixed,annual,variable,ads,adTarget,adRest:ads-adTarget,operating,purchases,flow,profitTax,profitRegime,rent,debt,investment,
   paid,principalPaid,profitPaid:paid-principalPaid,cumPaid,capital,allocated:pend,owed:owedCap+owedProfit,cash,freeCash,rentRemaining,reserve:d.minimumCash,
   days,visitors,adVisitors,baseVisitors,otherVisitors,fixedItems,annualItems,variableItems,oneOffItems,check};
 });
 // июль 2030: выплата за июнь и окончательный расчёт. Начисленное и не выплаченное отдаём; если капитал не вернулся, деньги бизнеса идут в счёт капитала.
 const lastPay=pendCap+pendProfit;capital-=pendCap;cash-=lastPay;
 const settle=Math.min(Math.max(0,cash),capital+owedProfit),settleCap=Math.min(capital,settle);
 capital-=settleCap;cash-=settle;const finalPaid=lastPay+settle;cumPaid+=finalPaid;if(capital<.01&&returned===null)returned='2030-07';
 const last=rows.at(-1);
 rows.push({...Object.fromEntries(Object.entries(last).map(([k2,v])=>[k2,typeof v==='number'?0:typeof v==='object'?{}:v])),month:'2030-07',paid:finalPaid,
  principalPaid:pendCap+settleCap,profitPaid:finalPaid-pendCap-settleCap,settlement:settle,cumPaid,capital,owed:0,cash,freeCash:cash,reserve:0});
 const paidIn=y=>rows.filter(r=>r.month.startsWith(y)).reduce((s,r)=>s+r.paid,0);
 return {position:p,rows,returned,totalPaid:cumPaid,lastPayment:finalPaid,settlement:settle,unreturned:capital,profitPaid:rows.reduce((s,r)=>s+r.profitPaid,0),
  paid2027:paidIn('2027'),extraFunding:Math.max(0,-minFree),reserveShortfall:Math.max(0,d.minimumCash-minFree),minimumFree:minFree,yearRevenue};
}
root.simulateMaison=simulate;if(typeof module!=='undefined')module.exports=simulate;
})(typeof window!=='undefined'?window:globalThis);
