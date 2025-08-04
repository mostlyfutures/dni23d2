#!/bin/bash

# Integration Test Runner
# This script runs the complete integration test suite

set -e

echo "🧪 Starting Integration Test Suite"
echo "=================================="

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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "Checking dependencies..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Check if backend is running
print_status "Checking backend status..."

# Try to connect to backend
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    print_success "Backend is running on port 3001"
else
    print_warning "Backend not detected on port 3001"
    print_status "Starting backend server..."
    
    # Start backend in background
    npm run backend &
    BACKEND_PID=$!
    
    # Wait for backend to start
    print_status "Waiting for backend to start..."
    sleep 5
    
    # Check if backend started successfully
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Backend started successfully"
    else
        print_error "Failed to start backend"
        exit 1
    fi
fi

# Check if frontend is running
print_status "Checking frontend status..."

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Frontend is running on port 3000"
else
    print_warning "Frontend not detected on port 3000"
    print_status "Starting frontend server..."
    
    # Start frontend in background
    npm start &
    FRONTEND_PID=$!
    
    # Wait for frontend to start
    print_status "Waiting for frontend to start..."
    sleep 10
    
    # Check if frontend started successfully
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend started successfully"
    else
        print_error "Failed to start frontend"
        exit 1
    fi
fi

# Run integration tests
print_status "Running integration tests..."
echo ""

# Run the integration test script
node scripts/test-integration.js

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "=================================="

# Cleanup background processes
if [ ! -z "$BACKEND_PID" ]; then
    print_status "Stopping backend server..."
    kill $BACKEND_PID 2>/dev/null || true
fi

if [ ! -z "$FRONTEND_PID" ]; then
    print_status "Stopping frontend server..."
    kill $FRONTEND_PID 2>/dev/null || true
fi

# Exit with test result
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_success "Integration tests completed successfully!"
    exit 0
else
    print_error "Integration tests failed!"
    exit 1
fi 