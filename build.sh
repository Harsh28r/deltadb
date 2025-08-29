#!/bin/bash
echo "🚀 Starting Vercel build for DeltaYards CRM API..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create logs directory if it doesn't exist
echo "📁 Creating necessary directories..."
mkdir -p logs uploads

# Build completed
echo "✅ Build completed successfully!"
echo "🎯 Ready for Vercel deployment!"
