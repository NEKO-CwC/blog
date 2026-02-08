'use strict';

const { S3, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const fg = require('fast-glob');
const fs = require('fs');
const mime = require('mime');
const path = require('path');
const crypto = require('crypto');

// Helper: Calculate MD5 of a file
const calculateMD5 = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

// Helper: List all objects in bucket with prefix
async function listAllObjects(s3, bucket, prefix) {
  let objects = new Map(); // Key -> ETag
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    });
    const response = await s3.send(command);
    (response.Contents || []).forEach(obj => {
      // Remove quotes from ETag
      const etag = obj.ETag ? obj.ETag.replace(/"/g, '') : '';
      objects.set(obj.Key, etag);
    });
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

// Register the 'r2' deployer
hexo.extend.deployer.register('r2', async function (args) {
  const {
    bucket,
    endpoint,
    region = 'auto',
    prefix = '',
    aws_key,
    aws_secret,
    concurrency = 20,
    pattern = '**/*'
  } = args;

  if (!bucket || !endpoint) {
    console.error('Error: bucket and endpoint are required in _config.yml');
    return;
  }

  // Use args or environment variables
  const accessKeyId = aws_key || process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = aws_secret || process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.error('Error: R2 credentials not found.');
    return;
  }

  const s3 = new S3({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });

  const publicDir = this.public_dir;

  console.log(`[R2 Sync] Scanning local files with pattern: ${pattern}`);
  const localFiles = await fg(pattern, { cwd: publicDir, onlyFiles: true });

  // 1. Get remote objects
  console.log(`[R2 Sync] Fetching remote objects...`);
  const remoteObjects = await listAllObjects(s3, bucket, prefix);
  console.log(`[R2 Sync] Found ${remoteObjects.size} remote objects.`);

  const toUpload = [];
  const toDelete = [];

  // 2. Identify files to upload (New or Changed)
  for (const file of localFiles) {
    const filePath = path.join(publicDir, file);
    // Construct Key: prefix + file path (posix style)
    const key = path.join(prefix, file).split(path.sep).join('/');

    if (remoteObjects.has(key)) {
      // Check MD5
      const localHash = await calculateMD5(filePath);
      const remoteHash = remoteObjects.get(key);
      if (localHash !== remoteHash) {
        toUpload.push({ file, key, filePath, reason: 'changed' });
      }
    } else {
      toUpload.push({ file, key, filePath, reason: 'new' });
    }
    // Remove from map to track matched files
    remoteObjects.delete(key);
  }

  // 3. Identify files to delete (Remaining in remoteObjects)
  // All objects remaining in remoteObjects are not present locally (or handled locally)
  // Since we want to sync the bucket to exactly match local files (and remove obsolete ones),
  // we delete everything remaining.
  for (const [key] of remoteObjects) {
    toDelete.push({ Key: key });
  }

  console.log(`[R2 Sync] Summary: ${toUpload.length} to upload, ${toDelete.length} to delete, ${localFiles.length - toUpload.length} unchanged.`);

  // 4. Execute Uploads
  const uploadFile = async (item) => {
    const { key, filePath, reason } = item;
    const contentType = mime.getType(filePath) || 'application/octet-stream';
    const body = fs.createReadStream(filePath);

    try {
      await s3.putObject({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      });
      console.log(`[R2 Sync] Uploaded (${reason}): ${key}`);
    } catch (err) {
      console.error(`[R2 Sync] Failed to upload ${key}:`, err.message);
      throw err;
    }
  };

  for (let i = 0; i < toUpload.length; i += concurrency) {
    const chunk = toUpload.slice(i, i + concurrency);
    await Promise.all(chunk.map(uploadFile));
  }

  // 5. Execute Deletes
  if (toDelete.length > 0) {
    // DeleteObjects handles max 1000 keys
    for (let i = 0; i < toDelete.length; i += 1000) {
      const chunk = toDelete.slice(i, i + 1000);
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk }
      }));
      console.log(`[R2 Sync] Deleted ${chunk.length} obsolete files.`);
    }
  }

  console.log('[R2 Sync] Synchronization completed.');
});

// Register console command 'clean-assets'
hexo.extend.console.register('clean-assets', 'Delete assets that matches deploy pattern from public dir', async function (args) {
  let deployConfig = this.config.deploy;

  if (Array.isArray(deployConfig)) {
    // Find the r2 deployer configuration
    deployConfig = deployConfig.find(d => d.type === 'r2');
  }

  if (!deployConfig || deployConfig.type !== 'r2') {
    console.log('[Clean Assets] No R2 deployer config found.');
    return;
  }

  const pattern = deployConfig.pattern;
  if (!pattern) {
    console.log('[Clean Assets] No pattern configured for R2 deployer. Skipping clean.');
    return;
  }

  console.log(`[Clean Assets] Cleaning files matching: ${pattern}`);
  const publicDir = this.public_dir;
  const files = await fg(pattern, { cwd: publicDir, absolute: true });

  if (files.length === 0) {
    console.log('[Clean Assets] No matching files found to clean.');
    return;
  }

  let deletedCount = 0;
  for (const file of files) {
    try {
      fs.unlinkSync(file);
      deletedCount++;
    } catch (e) {
      console.error(`[Clean Assets] Failed to delete ${file}:`, e.message);
    }
  }

  console.log(`[Clean Assets] Successfully deleted ${deletedCount} files.`);
});
