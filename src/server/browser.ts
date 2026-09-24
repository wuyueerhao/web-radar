// Kept in a separate dependency tree so the Cloudflare bundle stays unchanged.
import puppeteer from './dependencies/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
export default {
  async launch(_binding:unknown) {
    const endpoint=process.env.SERVER_BROWSER_WS;
    if(!endpoint)throw new Error('Server browser is not configured');
    return puppeteer.connect({browserWSEndpoint:endpoint,protocolTimeout:120000});
  }
};
