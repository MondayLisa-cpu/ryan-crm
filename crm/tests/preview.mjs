// Run after node scripts/local/preview.mjs. Chromium executable may be overridden.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:3100');
 await page.getByRole('button',{name:'預覽紀錄'}).click();await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.locator('#feed article').count(),0);
 await page.getByRole('button',{name:'預覽紀錄'}).click();await page.getByRole('button',{name:'確認儲存（示範）'}).click();assert.equal(await page.locator('#feed article').count(),1);
 await page.locator('#confirm').evaluate(el=>el.click());assert.equal(await page.locator('#feed article').count(),1);
 await page.getByLabel('同事',{exact:true}).selectOption({label:'示範同事 B'});await page.getByRole('button',{name:'預覽紀錄'}).click();await page.getByRole('button',{name:'確認儲存（示範）'}).click();assert.equal(await page.locator('#feed article').count(),2);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.reload();assert.equal(await page.locator('#feed article').count(),0);
 console.log('PASS preview: confirmation, cancellation, double-submit, two employees, mobile layout, reset');
}finally{await browser.close();}
