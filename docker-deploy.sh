#!/bin/bash

# DeltaYards CRM Docker Deployment Script
# This script builds and deploys both the API and Cron services

set -e

echo "🚀 Starting DeltaYards CRM Docker Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs uploads

# Set proper permissions
chmod 755 logs uploads

# Build and start services
print_status "Building and starting Docker services..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check service status
print_status "Checking service status..."

# Check API service
if docker-compose ps api | grep -q "Up"; then
    print_success "API service is running"
else
    print_error "API service failed to start"
    docker-compose logs api
    exit 1
fi

# Check Cron service
if docker-compose ps cron | grep -q "Up"; then
    print_success "Cron service is running"
else
    print_warning "Cron service may have issues (this is normal for scheduled tasks)"
    docker-compose logs cron
fi

# Check MongoDB service
if docker-compose ps mongodb | grep -q "Up"; then
    print_success "MongoDB service is running"
else
    print_error "MongoDB service failed to start"
    docker-compose logs mongodb
    exit 1
fi

# Test API health endpoint
print_status "Testing API health endpoint..."
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    print_success "API health check passed"
else
    print_warning "API health check failed - service may still be starting up"
fi

# Show service URLs
echo ""
print_success "🎉 Deployment completed successfully!"
echo ""
echo "📋 Service Information:"
echo "  • API Service: http://localhost:5000"
echo "  • Health Check: http://localhost:5000/api/health"
echo "  • MongoDB: localhost:27017"
echo "  • Cron Service: Running in background"
echo ""
echo "📊 Useful Commands:"
echo "  • View logs: docker-compose logs -f"
echo "  • View API logs: docker-compose logs -f api"
echo "  • View Cron logs: docker-compose logs -f cron"
echo "  • Stop services: docker-compose down"
echo "  • Restart services: docker-compose restart"
echo ""

print_status "Deployment script completed!"
