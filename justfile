localias:
    sudo go run github.com/peterldowns/localias/cmd/localias@latest run

caddy:
    sudo caddy run

start-ui:
    cd ui && pnpm run dev


start-backend:
    python3 -m uvicorn volunteers.app:app --reload
