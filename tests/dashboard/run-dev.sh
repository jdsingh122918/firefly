#!/bin/bash
# Wrapper script to run Next.js dev server with proper isolation
cd "$(dirname "$0")"
export NEXT_PRIVATE_STANDALONE=true
exec npx next dev -p 3001

