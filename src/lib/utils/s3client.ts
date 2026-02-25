import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || ''
const USE_LOCALSTACK = process.env.USE_LOCALSTACK === 'true'
const LOCALSTACK_S3_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566'

const localStackS3Config = {
  endpoint: LOCALSTACK_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
}

export const s3Client = new S3Client({
  region: AWS_REGION,
  ...(USE_LOCALSTACK ? localStackS3Config : {}),
})

export async function generatePresignedUrl(s3Key: string, expiresIn = 3600): Promise<string> {
  if (!S3_BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME is not set')
  }

  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    })

    return await getSignedUrl(s3Client, command, { expiresIn })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error generating presigned URL:', error)
    throw new Error(`Failed to generate presigned URL: ${message}`)
  }
}

export async function headObject(key: string): Promise<boolean> {
  if (!S3_BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME is not set')
  }
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key }))
    return true
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404) return false
    throw error
  }
}

