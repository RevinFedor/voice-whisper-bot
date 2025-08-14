#!/bin/bash

# Скрипт для тестирования AI генерации заголовков

echo "🚀 Запуск тестирования AI генерации заголовков..."

# Проверяем запущена ли база данных
docker ps | grep backend_postgres > /dev/null
if [ $? -ne 0 ]; then
    echo "📦 Запускаем базу данных..."
    cd backend
    docker-compose up -d
    sleep 3
    cd ..
fi

# Запускаем backend
echo "🔧 Запускаем backend..."
cd backend
npm run start:dev &
BACKEND_PID=$!
sleep 5

# Запускаем frontend
echo "🎨 Запускаем frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
sleep 3

echo "✅ Приложение запущено!"
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend API: http://localhost:3001/api"
echo "📍 Swagger: http://localhost:3001/api/docs"
echo ""
echo "📝 Инструкция для тестирования:"
echo "1. Откройте http://localhost:5173"
echo "2. Создайте или откройте заметку"
echo "3. Нажмите кнопку ✨ для генерации AI заголовка"
echo "4. Попробуйте Default и кастомные промпты"
echo "5. Проверьте историю заголовков (кнопка 📜)"
echo ""
echo "Нажмите Ctrl+C для остановки..."

# Ждем прерывания
trap "echo '🛑 Останавливаем приложение...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait