import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import puppeteer from '../../src/server/browser';
Object.assign(process.env,parseEnv(readFileSync(process.argv[2],'utf8')));
const browser=await puppeteer.launch({});
try {
  const page=await browser.newPage();await page.goto('https://example.com',{waitUntil:'domcontentloaded',timeout:30000});
  console.log('Browser public navigation:',await page.title());
  let blocked=false;
  try{await page.goto('http://169.254.169.254/latest/meta-data/',{waitUntil:'domcontentloaded',timeout:5000});}catch{blocked=true;}
  console.log('Metadata network access blocked:',blocked);
  if(!blocked)process.exitCode=1;
}finally{await browser.close();}
