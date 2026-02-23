import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '@/lib/db/prisma'
import type { Prisma } from '@prisma/client'

const BUCKET = process.env.S3_BUCKET_NAME || 'smarthome-radar-radar-data-802738533039'
const REGION = process.env.AWS_REGION || 'us-east-2'
const USE_LOCALSTACK = process.env.USE_LOCALSTACK === 'true'
const AWS_ENDPOINT = process.env.AWS_ENDPOINT

const s3Client = new S3Client({
  region: REGION,
  ...(USE_LOCALSTACK && AWS_ENDPOINT
    ? { endpoint: AWS_ENDPOINT, forcePathStyle: true }
    : {}),
})

export type DeviceType = 'transmitter' | 'receiver'

type FirmwareRecord = Prisma.FirmwareGetPayload<{}>

export async function getLatestFirmware(deviceType: DeviceType, currentVersion?: string) {
  const latest = (await (prisma as any).firmware.findFirst({
    where: { device_type: deviceType },
    orderBy: { created_at: 'desc' },
  })) as FirmwareRecord | null

  if (!latest) return null
  if (currentVersion && latest.version === currentVersion) return null

  const url = await presign(latest.s3_key)

  return {
    update_available: true,
    version: latest.version,
    url,
    size: latest.size,
    release_notes: latest.release_notes,
  }
}

async function presign(key: string) {
  // Ensure object exists; not strictly required but useful for LocalStack parity
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch (err) {
    // If head fails, still attempt to presign; caller will get 403/404 on fetch
    // console.warn('HeadObject failed for key', key, err)
  }

  const expiresIn = parseInt(process.env.OTA_PRESIGN_TTL_SECONDS || '900', 10)
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  )
}

