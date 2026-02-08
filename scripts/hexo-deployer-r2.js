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
  // ONLY delete files that match the pattern logic? 
  // R2 listObjects lists EVERYTHING. If we only sync images, we shouldn't delete HTML files we didn't check.
  // HOWEVER, the user said "If there are unneeded ones, automatically delete them".
  // BUT we are using a filter pattern now. 
  // SAFEGUARD: We should only delete files that *would* have been matched by the pattern but are missing locally.
  // This is hard to check perfectly on remote keys without re-running glob matcher on keys.
  // SIMPLIFICATION: We assume 'prefix' effectively isolates this deployment or the user understands 'sync'.
  // BETTER SAFEGUARD: Filter remoteObjects keys against the glob pattern (using micromatch/minimatch logic if needed, 
  // or just fast-glob's matcher if possible, but fast-glob works on FS).
  // For now, let's delete everything in 'prefix' that wasn't matched, IF we are sure.
  // Wait, if pattern is `**/*.{png...}`, we shouldn't delete `index.html`.
  // So we must filter `remoteObjects` keys to only those matching `pattern` before marking for deletion.

  const micromatch = require('picomatch'); // hexo depends on micromatch/picomatch usually? 
  // hexo-deployer-aws-s3 didn't use it. 'fast-glob' is already here.
  // fast-glob uses 'micromatch' internally.
  const isMatch = micromatch(pattern);

  for (const [key] of remoteObjects) {
    // Check if the remote key (relative to prefix) matches the pattern
    // We need to strip prefix for pattern matching if prefix exists
    let relativeKey = key;
    if (prefix && key.startsWith(prefix)) {
      relativeKey = key.slice(prefix.length);
      if (relativeKey.startsWith('/')) relativeKey = relativeKey.slice(1);
    }

    if (isMatch(relativeKey)) {
      toDelete.push({ Key: key });
    }
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
