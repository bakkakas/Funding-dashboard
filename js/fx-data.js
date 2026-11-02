export function parseBankFx(data, now=Date.now()) {
  const row=data?.exchangeInfo;
  const rate=Number(String(row?.closePrice??'').replaceAll(',',''));
  const at=Date.parse(row?.localTradedAt??'');
  if(row?.reutersCode!=='FX_USDKRW'||row?.unit!=='KRW'||!(rate>0)||!Number.isFinite(rate)||!Number.isFinite(at)||at>now+300000||now-at>7*86400000)throw Error('Invalid or stale bank FX');
  return {rate,at,source:'naver-hana',kind:'bank-reference',round:row.degreeCount??null};
}
export function parseMarketFx(data,now=Date.now()) {
  if(data?.source!=='naver-hana'||data?.kind!=='bank-reference'||typeof data.rate!=='number'||!Number.isFinite(data.rate)||data.rate<=0||typeof data.at!=='number'||!Number.isFinite(data.at)||data.at<=0||data.at>now+300000||now-data.at>7*86400000)throw Error('Invalid FX quote');
  return data;
}
