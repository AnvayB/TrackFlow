# Github commands:
add:
	git status
	git add .
	git status

# git commit -m "message"

# Only for Anvay
main:
	git checkout main
	git pull origin main
	git checkout anvay

# Start and Stop the application
start:
	cd orders && node server.js & \
	cd invoices && node server.js & \
	cd frontend && npm run dev

stop:
	@pkill -f "node server.js" || true
	@pkill -f "npm run dev" || true

restart:
	make stop
	make start


install-all:
	for dir in invoices orders notifications; do \
		(cd $$dir && npm install); \
	done


# Start and Stop the application with Docker
docker:
	docker-compose up --build
docker-build:
	docker-compose build
docker-up:
	docker-compose up
docker-down:
	docker-compose down
docker-start:
	docker-compose start
docker-stop:
	docker-compose stop

