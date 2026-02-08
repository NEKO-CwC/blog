'use strict';

const cheerio = require('cheerio');
const url = require('url');

// Filter hooks into the 'after_render:html' event
hexo.extend.filter.register('after_render:html', function (str, data) {
  const cdnUrl = this.config.cdn_url;
  if (!cdnUrl) return str;

  const $ = cheerio.load(str, { decodeEntities: false });
  let hasChanges = false;

  // 1. Replace Global Assets (/assets/...)
  $('img[src^="/assets/"]').each(function () {
    const src = $(this).attr('src');
    // Replace /assets/ with CDN_URL/assets/
    // We trim the leading slash from src to append to cdnUrl (which usually doesn't have trailing slash)
    // Actually, safest is new URL(src, cdnUrl).href but src is relative to root.
    // Let's assume cdnUrl is "https://cdn.example.com" and src is "/assets/img.png"
    // Result: "https://cdn.example.com/assets/img.png"

    // Check if cdnUrl ends with / to avoid double slash
    const finalCdn = cdnUrl.endsWith('/') ? cdnUrl.slice(0, -1) : cdnUrl;
    $(this).attr('src', finalCdn + src);
    hasChanges = true;
  });

  // 2. Replace Post Assets (/posts/:id/...)
  $('img[src^="/posts/"]').each(function () {
    const src = $(this).attr('src');
    const finalCdn = cdnUrl.endsWith('/') ? cdnUrl.slice(0, -1) : cdnUrl;
    $(this).attr('src', finalCdn + src);
    hasChanges = true;
  });

  return hasChanges ? $.html() : str;
});
