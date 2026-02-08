'use strict';

const cheerio = require('cheerio');

// Filter hooks into the 'after_render:html' event
hexo.extend.filter.register('after_render:html', function (str, data) {
  const cdnUrl = this.config.cdn_url;
  const siteUrl = this.config.url.replace(/\/+$/, ''); // Remove trailing slash

  if (!cdnUrl) {
    console.log('[CDN Filter] No cdn_url found in config.');
    return str;
  }

  const $ = cheerio.load(str, { decodeEntities: false });
  let hasChanges = false;

  console.log(`[CDN Filter] Processing: ${data.path || 'unknown path'}`);

  const processImage = (element) => {
    const attrs = ['src', 'data-src'];

    attrs.forEach(attr => {
      let val = $(element).attr(attr);
      if (!val) return;

      // 1. Convert absolute site URLs to relative first
      if (val.startsWith(siteUrl)) {
        val = val.substring(siteUrl.length);
      }

      // 2. Identify keys to replace
      if (val.startsWith('/assets/') || val.startsWith('/posts/') || val.startsWith('/images/')) {
        const finalCdn = cdnUrl.endsWith('/') ? cdnUrl.slice(0, -1) : cdnUrl;
        const newVal = finalCdn + val;

        console.log(`  [Replace] (${attr}) ${val} -> ${newVal}`);
        $(element).attr(attr, newVal);
        hasChanges = true;
      }
    });
  };

  $('img').each(function () {
    processImage(this);
  });

  return hasChanges ? $.html() : str;
});
