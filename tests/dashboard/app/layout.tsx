import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Firefly Test Dashboard',
  description: 'Integration test suite dashboard for Firefly platform',
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

