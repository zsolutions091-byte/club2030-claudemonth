import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'
import { DirectionProvider } from '@/components/ui/direction'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'משימות',
  description: 'מערכת ניהול משימות אישית',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <DirectionProvider direction="rtl">
          <AppShell>{children}</AppShell>
          <Toaster richColors position="bottom-left" />
        </DirectionProvider>
      </body>
    </html>
  )
}
