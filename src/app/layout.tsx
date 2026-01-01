import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SmartHome Radar API',
  description: 'Binary radar packet processing API for IoT devices',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
