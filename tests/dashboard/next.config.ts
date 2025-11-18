import type { NextConfig } from 'next'
import path from 'path'

const dashboardDir = path.resolve(__dirname)
const parentDir = path.resolve(__dirname, '../..')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Only process files in the app directory
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Don't transpile packages from parent directory
  transpilePackages: [],
  // Server components external packages (prevent importing parent packages)
  serverExternalPackages: [],
  // Configure Turbopack to only look in dashboard directory
  experimental: {
    turbo: {
      root: dashboardDir,
      resolveAlias: {
        '@': dashboardDir,
      },
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
      // Explicitly exclude parent directory from file scanning
      rules: {
        '*.ts': {
          loaders: [],
          as: '*.ts',
        },
      },
    },
  },
  // Exclude parent directory files from being processed (webpack fallback)
  webpack: (config, { isServer }) => {
    // Exclude parent directory from file watching
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        path.join(parentDir, '**'),
        `!${path.join(dashboardDir, '**')}`,
      ],
    }
    
    // Ensure @ alias points to dashboard directory only
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': dashboardDir,
    }
    
    // Ignore parent directory files during module resolution
    config.resolve.modules = [
      path.resolve(dashboardDir, 'node_modules'),
      'node_modules',
    ]
    
    // Add a plugin to ignore parent directory files
    const IgnoreParentFilesPlugin = {
      apply: (compiler: any) => {
        compiler.hooks.normalModuleFactory.tap('IgnoreParentFilesPlugin', (nmf: any) => {
          nmf.hooks.beforeResolve.tap('IgnoreParentFilesPlugin', (data: any) => {
            // Get the full path being resolved
            const requestPath = data.request || ''
            const contextPath = data.context || ''
            
            // If context is outside dashboard, ignore
            if (contextPath && !contextPath.startsWith(dashboardDir) && contextPath.startsWith(parentDir)) {
              return false
            }
            
            // If request references parent directory files, ignore
            if (requestPath && (
              requestPath.includes('proxy.ts') ||
              requestPath.includes('/lib/auth/') ||
              requestPath.includes('/lib/db/') ||
              (requestPath.startsWith('@/') && !requestPath.startsWith('@/app/') && !requestPath.startsWith('@/components/'))
            )) {
              // Check if it's trying to resolve from parent
              const resolvedPath = path.resolve(contextPath || dashboardDir, requestPath.replace('@/', ''))
              if (!resolvedPath.startsWith(dashboardDir)) {
                return false
              }
            }
          })
        })
      },
    }
    
    config.plugins = config.plugins || []
    config.plugins.push(IgnoreParentFilesPlugin)
    
    return config
  },
}

export default nextConfig
