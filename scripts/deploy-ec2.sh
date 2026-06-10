#!/usr/bin/env bash
# Deploy AgentBid stack to EC2 (postgres + agents + web).
# Usage: ./scripts/deploy-ec2.sh [ec2-host] [ssh-key]
set -euo pipefail

EC2_HOST="${1:-ec2-user@44.248.228.50}"
SSH_KEY="${2:-$HOME/.ssh/id_ed25519}"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Syncing production .env"
sed -e 's|localhost:5433|localhost:5432|' \
    -e 's|WEB_URL=.*|WEB_URL=http://localhost:3000|' \
    -e 's|AGENTS_BASE_URL=.*|AGENTS_BASE_URL=http://localhost:4000|' \
    -e 's|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=http://44.248.228.50:3000|' \
    "$REPO_ROOT/.env" > /tmp/agentbid-ec2.env
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no /tmp/agentbid-ec2.env "$EC2_HOST:~/governer/.env"

echo "==> Pulling latest code"
$SSH "$EC2_HOST" 'cd ~/governer && git pull --ff-only origin main'

echo "==> Postgres + migrations"
$SSH "$EC2_HOST" 'bash -s' << 'REMOTE'
set -euo pipefail
cd ~/governer
if ! sudo docker ps -a --format "{{.Names}}" | grep -q "^agentbid-postgres$"; then
  sudo docker run -d --name agentbid-postgres --restart unless-stopped \
    -e POSTGRES_DB=agentbid -e POSTGRES_USER=agentbid -e POSTGRES_PASSWORD=agentbid \
    -p 5432:5432 -v agentbid_pgdata:/var/lib/postgresql/data postgres:15
else
  sudo docker start agentbid-postgres 2>/dev/null || true
fi
for i in $(seq 1 30); do
  sudo docker exec agentbid-postgres pg_isready -U agentbid -d agentbid >/dev/null 2>&1 && break
  sleep 2
done
for f in db/migrations/*.sql; do
  sudo docker exec -i agentbid-postgres psql -U agentbid -d agentbid < "$f" 2>/dev/null || true
done
REMOTE

echo "==> Building agents"
$SSH "$EC2_HOST" 'cd ~/governer/apps/agents && npm install && npm run build && pm2 restart agentbid-agents || pm2 start npm --name agentbid-agents --cwd /home/ec2-user/governer/apps/agents -- start'

echo "==> Building web"
$SSH "$EC2_HOST" 'cd ~/governer/apps/web && export NODE_OPTIONS="--dns-result-order=ipv4first --max-old-space-size=1536" && npm install && npm run build && pm2 restart agentbid-web || PORT=3000 pm2 start npm --name agentbid-web --cwd /home/ec2-user/governer/apps/web -- start'
$SSH "$EC2_HOST" 'pm2 save'

echo "==> Health checks (on instance)"
$SSH "$EC2_HOST" 'curl -sf http://localhost:4000/health && echo && curl -sf http://localhost:3000/api/health && echo'
echo "Deploy complete. Public URL: http://44.248.228.50:3000"
