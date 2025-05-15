# Github commands:
add:
	git status
	git add .
	git status

# git commit -m "message"

anvay:
	git push origin anvay

main:
	git checkout main
	git pull origin main
	git checkout anvay

thomas:
	git push origin thomas

maint:
	git checkout main
	git pull origin main
	git checkout thomas

# Start and Stop the application
start:
	cd orders && node server.js & \
	cd invoices && node server.js & \
	cd frontend && npm run dev

# New start-prod command (production mode)
start-prod:
	cd orders && NODE_ENV=production AWS_REGION=us-east-2 node server.js & \
	cd invoices && NODE_ENV=production AWS_REGION=us-east-2 node server.js & \
	cd frontend && npm run dev

stop-prod:
	cd orders && NODE_ENV=production AWS_REGION=us-east-2 pkill -f "node server.js" || true
	cd invoices && NODE_ENV=production AWS_REGION=us-east-2 pkill -f "node server.js" || true
	cd frontend && npm run dev pkill -f "npm run dev" || true

stop:
	@pkill -f "node server.js" || true
	@pkill -f "npm run dev" || true

restart:
	make stop
	make start

# Install all dependencies
install-all:
	for dir in frontend invoices orders notifications; do \
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



# New start-prod command (production mode)
start-prod:
	cd orders && NODE_ENV=production AWS_REGION=us-east-2 node server.js & \
	cd invoices && NODE_ENV=production AWS_REGION=us-east-2 node server.js & \
	cd frontend && npm run dev