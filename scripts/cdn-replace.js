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
    let src = $(element).attr('src');
    if (!src) return;

    // 1. Convert absolute site URLs to relative first
    // e.g. https://blog.neko-cwc.com:8443/posts/xyz -> /posts/xyz
    if (src.startsWith(siteUrl)) {
      src = src.substring(siteUrl.length);
    }

    // 2. Identify keys to replace
    // Matches /assets/... or /posts/...
    if (src.startsWith('/assets/') || src.startsWith('/posts/')) {
      const finalCdn = cdnUrl.endsWith('/') ? cdnUrl.slice(0, -1) : cdnUrl;
      const newSrc = finalCdn + src;

      console.log(`  [Replace] ${src} -> ${newSrc}`);
      $(element).attr('src', newSrc);
      hasChanges = true;
    }
  };

  $('img').each(function () {
    processImage(this);
  });

  return hasChanges ? $.html() : str;
});
