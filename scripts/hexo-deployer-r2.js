'use strict';

const { S3 } = require('@aws-sdk/client-s3');
const fg = require('fast-glob');
const fs = require('fs');
const mime = require('mime');
const path = require('path');

// Register the 'r2' deployer
hexo.extend.deployer.register('r2', async function (args) {
  const {
    bucket,
    endpoint,
    region = 'auto',
    prefix = '',
    aws_key,
    aws_secret,
    concurrency = 20
  } = args;

  if (!bucket || !endpoint) {
    const help = `
You should configure deployment settings in _config.yml first!

Example:
  deploy:
    type: r2
    bucket: <bucket_name>
    endpoint: <r2_endpoint_url>
    region: auto
    aws_key: <access_key_id> # Optional, can be read from env AWS_ACCESS_KEY_ID
    aws_secret: <secret_access_key> # Optional, can be read from env AWS_SECRET_ACCESS_KEY
`;
    console.error(help);
    return;
  }

  // Use args or environment variables
  const accessKeyId = aws_key || process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = aws_secret || process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.error('Error: R2 credentials not found in config or environment variables.');
    return;
  }

  const s3 = new S3({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  const publicDir = this.public_dir;
  const files = await fg('**/*', { cwd: publicDir, onlyFiles: true });

  console.log(`[R2 Deploy] Found ${files.length} files to upload.`);

  // Upload logic with simple concurrency control
  const uploadFile = async (file) => {
    const filePath = path.join(publicDir, file);
    // Construct Key: prefix + file path (posix style)
    const key = path.join(prefix, file).split(path.sep).join('/');
    const contentType = mime.getType(filePath) || 'application/octet-stream';
    const body = fs.createReadStream(filePath);

    try {
      await s3.putObject({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // ACL: 'public-read' // R2 usually doesn't need ACL if bucket is public, but can keep if compatible
      });
      console.log(`[R2 Deploy] Uploaded: ${key}`);
    } catch (err) {
      console.error(`[R2 Deploy] Failed to upload ${key}:`, err.message);
      throw err;
    }
  };

  // Process uploads in chunks
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    await Promise.all(chunk.map(uploadFile));
  }

  console.log('[R2 Deploy] Deployment completed successfully.');
});
