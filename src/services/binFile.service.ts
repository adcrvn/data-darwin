import { getLatestBinFile, getBinFileByName, listBinFiles, uploadBinFile } from '@/lib/storage/bin-storage'

export async function fetchLatestBinFile(fileNameParam?: string) {
  if (fileNameParam) {
    const normalizedRequestedName = fileNameParam.toLowerCase()
    const baseRequestedName = normalizedRequestedName.replace(/\.bin$/, '')
    const allFiles = await listBinFiles(100, 0)
    return (
      allFiles.find((f) => {
        if (f.projectName?.toLowerCase() === baseRequestedName) {
          return true
        }
        const fileNameLower = f.name.toLowerCase()
        return fileNameLower.startsWith(baseRequestedName + '_') || fileNameLower === `${baseRequestedName}.bin`
      }) || null
    )
  }

  return await getLatestBinFile()
}

export async function fetchBinFileByName(fileName: string) {
  return await getBinFileByName(fileName)
}

export async function fetchBinFiles(limit: number, offset: number) {
  return await listBinFiles(limit, offset)
}

export async function uploadBinaryFile(buffer: Buffer, filename?: string, useOTAParser: boolean = true) {
  return await uploadBinFile(buffer, filename, useOTAParser)
}
