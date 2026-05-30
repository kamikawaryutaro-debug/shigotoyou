import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config();

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME
} = process.env;

let s3Client = null;

export const getS3Client = () => {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.warn('⚠️ Cloudflare R2の環境変数が不足しています');
    }
    
    s3Client = new S3Client({
      region: 'auto',
      endpoint: \`https://\${R2_ACCOUNT_ID}.r2.cloudflarestorage.com\`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
};

export const getBucketName = () => {
  return R2_BUCKET_NAME || 'contract-approval-bucket';
};

/**
 * ファイルをR2にアップロード
 * @param {string} key - S3のオブジェクトキー（保存先パス+ファイル名）
 * @param {Buffer|Uint8Array|string} body - ファイルのデータ
 * @param {string} contentType - MIMEタイプ
 */
export const uploadFileToS3 = async (key, body, contentType) => {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  
  await client.send(command);
  return key;
};

/**
 * R2からファイルをダウンロードし、Bufferとして返す
 * @param {string} key - S3のオブジェクトキー
 */
export const downloadFileFromS3 = async (key) => {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  
  const response = await client.send(command);
  
  // ReadableStreamをBufferに変換
  const streamToBuffer = (stream) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });

  return await streamToBuffer(response.Body);
};

/**
 * R2のファイルを削除
 * @param {string} key - S3のオブジェクトキー
 */
export const deleteFileFromS3 = async (key) => {
  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  
  await client.send(command);
};

/**
 * R2のファイルを一時的に閲覧するための署名付きURLを生成
 * @param {string} key - S3のオブジェクトキー
 * @param {number} expiresIn - 有効期限（秒）デフォルト3600秒(1時間)
 */
export const getPresignedUrl = async (key, expiresIn = 3600) => {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  
  return await getSignedUrl(client, command, { expiresIn });
};
