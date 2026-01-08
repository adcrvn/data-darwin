# SmartHome Radar API

A Next.js API for processing and storing binary radar packet data from IoT devices.

## Features

- Binary packet processing for radar sensors (dynamic sensor count support)
- PostgreSQL database with Prisma ORM (AWS RDS)
- AWS S3 integration for CSV and binary file storage
- **Hourly CSV storage** - Automatic CSV file generation organized by building/room/date/hour
- TypeScript for type safety
- Data validation with Zod
- Parses binary data into human-readable format
- Flexible radar target structure supporting any number of sensors
- Deployed on AWS with Terraform infrastructure as code

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (AWS RDS or local)
- AWS account with S3 access (for production)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in your database and AWS credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `DIRECT_URL` - Direct PostgreSQL connection (for migrations)
- `AWS_REGION` - AWS region (e.g., us-east-2)
- `S3_BUCKET_NAME` - S3 bucket name for radar data storage

4. Run database migrations:

```bash
npx prisma migrate dev
```

5. Run the development server:

```bash
npm run dev
```

The API will be available at [http://localhost:3000](http://localhost:3000)

## API Endpoints

### POST /api/radar-data

Submit binary radar packet to the database. Accepts raw binary data and automatically stores it to both PostgreSQL and AWS S3 CSV storage.

**Request:**
- Content-Type: `application/octet-stream`
- Body: Binary packet data (variable length based on sensor count)

**Binary Packet Structure:**
- Magic number: 0xDEADBEEF (4 bytes)
- Header: version, packet_length, MAC address, room/building IDs (28 bytes total)
- Radar targets: N sensors × 3 targets × 13 bytes (variable length)
- CSI data: Complex I/Q samples (2 × csi_len bytes)

**Note:** Data is automatically stored to CSV files in AWS S3 at:
`radar-readings/building_id/room_id/YYYY-MM-DD/HH.csv`

**Example using curl:**

```bash
curl -X POST http://localhost:3000/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @packet.bin
```

**Response:**

```json
{
  "success": true,
  "id": "uuid-here",
  "message": "Successfully processed radar packet",
  "data": {
    "rx_mac": "F0:F5:BD:02:FA:80",
    "timestamp_ms": "10000",
    "seq_number": "1",
    "room_id": 2,
    "building_id": 1
  }
}
```

### GET /api/radar-data

Retrieve radar readings from the database.

**Query Parameters:**

- `rx_mac` (optional): Filter by device MAC address
- `room_id` (optional): Filter by room ID
- `building_id` (optional): Filter by building ID
- `limit` (optional, default: 100): Number of records to return
- `offset` (optional, default: 0): Number of records to skip

**Example:**

```bash
curl "http://localhost:3000/api/radar-data?rx_mac=F0:F5:BD:02:FA:80"
```

### GET /api/csv-data

Retrieve CSV files from AWS S3 storage or list available CSV files.

**Query Parameters:**

- `building_id` (required): Building ID
- `room_id` (required): Room ID
- `date` (required): Date in YYYY-MM-DD format
- `hour` (optional): Hour in HH format (00-23). If provided, downloads the CSV file; otherwise lists all files for the date.

**Example - List files for a date:**

```bash
curl "http://localhost:3000/api/csv-data?building_id=1&room_id=2&date=2025-12-11"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "building_id": 1,
    "room_id": 2,
    "date": "2025-12-11",
    "files": ["00.csv", "01.csv", "02.csv", "03.csv"]
  }
}
```

**Example - Download specific hour CSV:**

```bash
curl "http://localhost:3000/api/csv-data?building_id=1&room_id=2&date=2025-12-11&hour=03" \
  -o data.csv
```

Returns CSV file with headers:
```
timestamp_ms,rx_mac,room_id,building_id,seq_number,csi_counter,version,packet_length,rssi,channel,csi_len,radar_targets,csi_data
```

## CSV Storage Structure

CSV files are automatically organized in AWS S3 with the following hierarchy:

```
radar-readings/
├── building_1/
│   ├── room_1/
│   │   ├── 2025-12-11/
│   │   │   ├── 00.csv
│   │   │   ├── 01.csv
│   │   │   ├── 02.csv
│   │   │   └── ...
│   │   └── 2025-12-12/
│   │       └── ...
│   └── room_2/
│       └── ...
└── building_2/
    └── ...
```

Each CSV file contains all radar readings for that specific hour.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rxMac": "F0:F5:BD:02:FA:80",
      "roomId": 2,
      "buildingId": 1,
      "timestampMs": "10000",
      "rssi": -40,
      "channel": 6,
      "ld2450Targets": [...],
      "rd03dTargets": [...],
      "csiData": [[1, -2], [2, -3], ...]
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

## Database Schema

The `radar_readings` table stores parsed binary data:

- `rx_mac`: Device MAC address
- `room_id`, `building_id`: Location identifiers
- `seq_number`, `csi_counter`: Sequence tracking
- `timestamp_ms`: Timestamp in milliseconds
- `rssi`, `channel`: Signal information
- `ld2450_targets`: Array of LD2450 radar targets (JSON)
- `rd03d_targets`: Array of RD03D radar targets (JSON)
- `csi_data`: Channel State Information as I/Q pairs (JSON)

Each target includes: `x_mm`, `y_mm`, `dist_mm`, `speed_cms`, `angle_deg_x10`, `track_id`, `valid`

## Testing

See `test-data/README.md` for comprehensive testing instructions.

**Quick test:**

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Send test packet
cd test-data
curl -X POST http://localhost:3000/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test_radar_packet.bin
```

## Development

### Database Commands

- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Create and run migrations
- `npm run db:studio` - Open Prisma Studio

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run linter

## Technology Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Prisma** - ORM for database access
- **PostgreSQL (AWS RDS)** - Database
- **AWS S3** - File storage for CSV and binary files
- **Zod** - Runtime type validation
- **Terraform** - Infrastructure as code
- **Docker** - Containerization
- **AWS EC2/ALB/ASG** - Compute and load balancing

