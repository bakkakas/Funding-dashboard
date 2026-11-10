import test from 'node:test';import assert from 'node:assert/strict';
import {parseUsdMarketCap,formatMarketCapKrw} from '../js/market-cap-krw.js';
test('provider USD Korean units parse without confusing KRW or unsupported values',()=>{
 assert.equal(parseUsdMarketCap('1조 9,349억 USD'),1934900000000);
 assert.equal(parseUsdMarketCap('2.54억 USD'),254000000);
 assert.equal(parseUsdMarketCap('1,357억 USD'),135700000000);
 assert.equal(parseUsdMarketCap('100 USD'),100);
 for(const value of ['500억원','2.5B USD','미제공',null,'-2억 USD'])assert.equal(parseUsdMarketCap(value),null);
});
test('KRW formats trillion fixed2 and hundred-million whole units with safe unavailable inputs',()=>{
 assert.equal(formatMarketCapKrw(1e9,1350),'1.35조원');
 assert.equal(formatMarketCapKrw(254e6,1350),'3,429억원');
 assert.equal(formatMarketCapKrw(999999999999,1),'9,999억원');
 assert.equal(formatMarketCapKrw(1e12,1),'1.00조원');
 assert.equal(formatMarketCapKrw(1e8-1,1),'99,999,999원');
 for(const [usd,fx] of [[null,1300],[10,null],[10,0],[-10,1300],[Infinity,1300]])assert.equal(formatMarketCapKrw(usd,fx),null);
});
