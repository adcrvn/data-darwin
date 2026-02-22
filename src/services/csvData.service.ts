import { getCSVFile, listCSVFilesForDate } from '@/lib/storage/csv-storage'

export async function fetchCSVFile(buildingId: number, roomId: number, date: string, hour: string) {
  const csvContent = await getCSVFile(buildingId, roomId, date, hour)
  return csvContent
}

export async function fetchCSVFilesForDate(buildingId: number, roomId: number, date: string) {
  const files = await listCSVFilesForDate(buildingId, roomId, date)
  return files.sort()
}
