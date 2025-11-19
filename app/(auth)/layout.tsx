import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Let individual auth pages handle their own redirect logic
  // to avoid conflicts between server and client-side redirects

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Hero Image (hidden on mobile, shown on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary/5 items-center justify-center p-0 relative overflow-hidden">
        <Image
          src="/firefly-login.jpg"
          alt="Firefly - Supporting families through end of life care"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 max-w-md text-center text-white p-12">
          <h1 className="text-4xl font-bold mb-4">
            Firefly
          </h1>
          <p className="text-xl">
            Supporting families through end of life care with compassion and community
          </p>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Firefly Logo for mobile and desktop with theme-aware switching */}
          <div className="text-center">
            {/* Black logo for light mode */}
            <Image
              src="/firefly-logo-black.png"
              alt="Firefly - End of Life Care Platform"
              width={200}
              height={80}
              priority
              className="mx-auto mb-4 dark:hidden object-contain"
            />
            {/* White logo for dark mode */}
            <Image
              src="/firefly-logo-white.png"
              alt="Firefly - End of Life Care Platform"
              width={200}
              height={80}
              priority
              className="mx-auto mb-4 hidden dark:block object-contain"
            />
            <h1 className="text-2xl font-bold text-foreground lg:hidden">
              Firefly
            </h1>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}