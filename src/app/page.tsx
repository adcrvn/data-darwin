export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>SmartHome Radar API</h1>
      <p>Binary radar packet processing API is running.</p>
      <ul>
        <li>
          <strong>POST /api/radar-data</strong> - Submit binary radar packets (application/octet-stream)
        </li>
        <li>
          <strong>GET /api/radar-data</strong> - Retrieve radar readings
          <ul>
            <li>Query params: rx_mac, room_id, building_id, limit (default 100), offset (default 0)</li>
          </ul>
        </li>
      </ul>
    </div>
  )
}
