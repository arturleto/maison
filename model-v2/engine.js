(function(root){'use strict';
function simulate(d,position){
 const p=Math.max(0,Math.min(100,Number(position))),a=p<=50?0:1,b=a+1,t=p<=50?p/50:(p-50)/50,keys=['pes','std','opt'];
 const mix=(x,y)=>x+(y-x)*t,check=mix(d.checks[a],d.checks[b]),c=d.costs,sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
 const rentSchedule=c['аренда_график_IDR'].filter(x=>x[0].slice(0,7)>=d.months[0]);
 let rentRemaining=rentSchedule.reduce((s,x)=>s+x[1],0),cash=0,carry=0,capital=d.investment,cumPaid=0,returned=null,pending=0,pendingCapital=0,minFree=Infinity;
 const rows=d.months.map((month,i)=>{
  const mo=+month.slice(5),year=+month.slice(0,4),ramp=k=>d.ramps[k][Math.min(i,d.ramps[k].length-1)];
  const revenue=mix(ramp(keys[a]),ramp(keys[b]))*d.seasonality[mo-1],store=revenue*d.commission;
  const fixedItems={...c['в_месяц_IDR']};for(const[k,v]of Object.entries(c['в_месяц_IDR_с_даты']))if(v['с']==='после_возврата'?returned!==null:month>=v['с'])fixedItems[k]=v.IDR;
  const annualItems={};for(const x of d.annualSchedule)if(x.months.includes(mo))annualItems[x.name]=x.amount/x.months.length;
  const variableItems=Object.fromEntries(Object.entries(c['от_выручки']).map(([k,v])=>[k,v*revenue]));
  variableItems['Пакеты']=revenue/check*c['пакет_IDR_на_чек'];
  const adBase=variableItems['Реклама'],ads=Math.max(adBase,i<d.marketingFloorMonths?d.marketingFloor:0);variableItems['Реклама']=ads;
  const oneOffItems=Object.fromEntries(d.oneOff.filter(x=>x.month===month).map(x=>[x.what,x.idr]));if(i===0)oneOffItems['Наружная реклама: подготовка, бюджетная оценка']=d.marketingSetup;
  const fixed=sum(fixedItems),annual=sum(annualItems),variable=sum(variableItems),purchases=sum(oneOffItems),operating=store-fixed-annual-variable,flow=operating-purchases;
  const rent=rentSchedule.filter(x=>x[0].slice(0,7)===month).reduce((s,x)=>s+x[1],0),debt=i===0?d.brandDebt:0,investment=i===0?d.investment:0;
  const paid=pending,principalPaid=pendingCapital;capital-=principalPaid;cumPaid+=paid;if(capital<.01&&returned===null)returned=month;
  rentRemaining-=rent;cash+=investment+flow-rent-debt-paid;
  const dist=Math.max(0,flow-carry);carry=Math.max(0,carry-flow);
  const principal=Math.min(capital,dist*.8),desired=principal+(capital-principal<.01?Math.max(0,dist-principal/.8)*.15:0);
  pending=Math.min(desired,Math.max(0,cash-rentRemaining-d.minimumCash));pendingCapital=Math.min(principal,pending);
  const freeCash=cash-rentRemaining-pending;minFree=Math.min(minFree,freeCash);
  return {month,revenue,store,brands:revenue-store,fixed,annual,variable,ads,adBase,adTopup:ads-adBase,operating,purchases,flow,rent,debt,investment,paid,principalPaid,profitPaid:paid-principalPaid,cumPaid,capital,allocated:pending,cash,freeCash,rentRemaining,carry,reserve:d.minimumCash,fixedItems,annualItems,variableItems,oneOffItems,check,visitors:revenue/check/d.conversion/new Date(year,mo,0).getDate(),rentExpense:d.rentExpense,profitAfterRent:operating-d.rentExpense};
 });
 const last=rows.at(-1);capital-=pendingCapital;cumPaid+=pending;cash-=pending;if(capital<.01&&returned===null)returned='2030-07';
 rows.push({...Object.fromEntries(Object.entries(last).map(([k,v])=>[k,typeof v==='number'?0:typeof v==='object'?{}:v])),month:'2030-07',paid:pending,principalPaid:pendingCapital,profitPaid:pending-pendingCapital,cumPaid,capital,cash,freeCash:cash,reserve:d.minimumCash});
 return {position:p,rows,returned,totalPaid:cumPaid,paidByJune:cumPaid-pending,lastPayment:pending,unreturned:capital,profitPaid:rows.reduce((s,r)=>s+r.profitPaid,0),extraFunding:Math.max(0,-minFree),reserveShortfall:Math.max(0,d.minimumCash-minFree),minimumFree:minFree};
}
root.simulateMaison=simulate;if(typeof module!=='undefined')module.exports=simulate;
})(typeof window!=='undefined'?window:globalThis);
