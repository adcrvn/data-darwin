import { NextRequest, NextResponse } from 'next/server'
import { getCSVFile, listCSVFilesForDate } from '@/lib/storage/csv-storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('building_id')
    const roomId = searchParams.get('room_id')
    const date = searchParams.get('date') // YYYY-MM-DD
    const hour = searchParams.get('hour') // HH (optional)
    
    if (!buildingId || !roomId || !date) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: building_id, room_id, date',
      }, { status: 400 })
    }
    
    // If hour is specified, return specific CSV file
    if (hour) {
      const csvContent = await getCSVFile(
        parseInt(buildingId),
        parseInt(roomId),
        date,
        hour
      )
      
      if (!csvContent) {
        return NextResponse.json({
          success: false,
          error: 'CSV file not found',
        }, { status: 404 })
      }
      
      // Return CSV file
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${buildingId}_${roomId}_${date}_${hour}.csv"`,
        },
      })
    }
    
    // Otherwise, list all CSV files for the date
    const files = await listCSVFilesForDate(
      parseInt(buildingId),
      parseInt(roomId),
      date
    )
    
    return NextResponse.json({
      success: true,
      data: {
        building_id: parseInt(buildingId),
        room_id: parseInt(roomId),
        date,
        files: files.sort(),
      },
    })
    
  } catch (error) {
    console.error('Error retrieving CSV data:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
