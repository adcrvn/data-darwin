import { prisma } from '@/lib/db/prisma'

export async function checkHealth() {
  await prisma.$queryRaw`SELECT 1`
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
  }
}

export async function getLatestReadingsPerDevice() {
  // Get distinct device MACs
  const devices = await prisma.radarReading.findMany({
    select: { rx_mac: true },
    distinct: ['rx_mac'],
  })

  const results = await Promise.all(
    devices.map(async ({ rx_mac }) => {
      const rec = await prisma.radarReading.findFirst({
        where: { rx_mac },
        orderBy: { timestamp_ms: 'desc' },
        select: {
          rx_mac: true,
          building_id: true,
          room_id: true,
          received_at: true,
          created_at: true,
          radar_targets: true,
          csi_data: true,
        },
      })

      if (!rec) return null

      const hasRadarTargets = Array.isArray(rec.radar_targets) && rec.radar_targets.length > 0
      const hasCsiData = Array.isArray(rec.csi_data) && rec.csi_data.length > 0

      return {
        rx_mac: rec.rx_mac,
        building_id: rec.building_id,
        room_id: rec.room_id,
        received_at: rec.received_at,
        created_at: rec.created_at,
        radar_targets: hasRadarTargets ? 1 : 0,
        csi_data: hasCsiData ? 1 : 0,
      }
    })
  )

  return results.filter(Boolean)
}
