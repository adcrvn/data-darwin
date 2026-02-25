import { prisma } from '@/lib/db/prisma'
import { generatePresignedUrl, headObject } from '@/lib/utils/s3client'

const PRESIGN_TTL_SECONDS = parseInt(process.env.OTA_PRESIGN_TTL_SECONDS || '900', 10)

export type DeviceType = 'transmitter' | 'receiver'

export async function getLatestFirmware(deviceType: DeviceType, currentVersion?: string) {
  const latest = (await prisma.firmware.findFirst({
    where: { device_type: deviceType, is_latest: true },
  }))

  if (!latest) return null
  if (currentVersion && latest.version === currentVersion) return null

  const exists = await headObject(latest.s3_key)
  if (!exists) {
    return null
  }

  const url = await generatePresignedUrl(latest.s3_key, PRESIGN_TTL_SECONDS)

  return {
    update_available: true,
    version: latest.version,
    url,
    size: latest.size,
    release_notes: latest.release_notes,
  }
}

