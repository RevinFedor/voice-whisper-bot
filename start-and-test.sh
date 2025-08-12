#!/bin/bash

echo "🚀 Starting Notes Application Test Suite"
echo "========================================="

echo "📦 Installing dependencies..."
cd backend && npm install &
cd frontend && npm install &
cd e2e && npm install &
wait

echo "🐘 Starting PostgreSQL..."
cd backend
docker-compose up -d
sleep 5

echo "🔧 Running Prisma migrations..."
npx prisma generate
npx prisma db push

echo "🚀 Starting backend server..."
npm run start:dev &
BACKEND_PID=$!
sleep 10

echo "⚛️ Starting frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
sleep 10

echo "🧪 Running Playwright tests..."
cd ../e2e
mkdir -p screenshots
npx playwright test --reporter=list

echo "📊 Test results saved to e2e/test-results.json"
echo "📸 Screenshots saved to e2e/screenshots/"

echo "🧹 Cleanup (press Ctrl+C to stop services)..."
read -p "Press Enter to stop all services..."

kill $BACKEND_PID
kill $FRONTEND_PID
cd ../backend && docker-compose down

echo "✅ All services stopped"