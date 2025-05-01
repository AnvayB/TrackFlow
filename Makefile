add:
	git status
	git add .
	git status

# git commit -m "message"

main:
	git checkout main
	git branch
	git pull

start:
	cd orders && node server.js & \
	cd verification && node server.js & \
	cd frontend && npm run dev

stop:
	@pkill -f "node server.js" || true
	@pkill -f "npm run dev" || true



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

