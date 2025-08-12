# Database commands
db-start:
	docker-compose up -d

db-stop:
	docker-compose down

db-restart:
	docker-compose restart

db-logs:
	docker-compose logs -f postgres

db-shell:
	docker exec -it voice-notes-db psql -U postgres -d voice_notes_db

db-reset:
	docker-compose down -v
	docker-compose up -d
	sleep 3
	npx prisma migrate dev --name init

# Development commands
dev:
	npm run start:dev

migrate:
	npx prisma migrate dev

studio:
	npx prisma studio

# Full setup
setup:
	npm install
	docker-compose up -d
	sleep 3
	npx prisma generate
	npx prisma migrate dev --name init
	@echo "✅ Setup complete! Run 'make dev' to start the backend"

# Full start (DB + Backend)
start: db-start
	npm run start:dev

.PHONY: db-start db-stop db-restart db-logs db-shell db-reset dev migrate studio setup start