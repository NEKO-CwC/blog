const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const GITHUB_TOKEN = process.env.GH_PAT;
const OWNER = 'NEKO-CwC';
const REPO = 'blog';
const ENDPOINT = `https://api.github.com/repos/${OWNER}/${REPO}/issues`;
const SITE_URL = 'https://blog.neko-cwc.com:8443';

async function initIssues() {
  // Support both file-based and directory-based permalinks
  // e.g., public/posts/abc.html or public/posts/abc/index.html
  const files = glob.sync('public/posts/**/*.html');

  for (const file of files) {
    let identifier;
    const filename = path.basename(file, '.html');

    if (filename === 'index') {
      // public/posts/1a2b3c/index.html -> 1a2b3c
      identifier = path.basename(path.dirname(file));
    } else {
      // public/posts/1a2b3c.html -> 1a2b3c
      identifier = filename;
    }

    // Skip non-article pages if any (e.g. index.html of posts dir itself)
    // Abbrlinks are usually hex/numeric. 
    if (identifier === 'posts' || identifier === 'public') continue;

    const content = fs.readFileSync(file, 'utf8');
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].split('|')[0].trim() : identifier;

    console.log(`检查文章: ${title} [ID: ${identifier}]`);

    try {
      // 检查是否已有对应 Label 的 Issue
      const res = await axios.get(ENDPOINT, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
        params: { labels: `Gitalk,${identifier}`, state: 'all' }
      });

      if (res.data.length === 0) {
        // 创建新 Issue
        const issueBody = `此 Issue 用于 "${title}" 的评论管理。\n文章地址: ${SITE_URL}/posts/${identifier}/`;

        await axios.post(ENDPOINT, {
          title: title,
          body: issueBody,
          labels: ['Gitalk', identifier]
        }, {
          headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        console.log(`✅ 已创建 Issue`);
      } else {
        console.log(`ℹ️ Issue 已存在，跳过`);
      }
    } catch (e) {
      console.error(`❌ 失败: ${e.message}`);
      if (e.response) {
        console.error(`Status: ${e.response.status}`);
      }
    }
  }
}

if (!GITHUB_TOKEN) {
  console.error("❌ Error: GH_PAT environment variable is not set.");
  process.exit(1);
}

initIssues();
