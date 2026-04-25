#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# BrunoRAG Deploy Script — run on a fresh Ubuntu 22.04 Droplet
# Usage: bash deploy.sh YOUR_DOMAIN
# ============================================================

DOMAIN="${1:?Usage: bash deploy.sh YOUR_DOMAIN}"

echo "==> Deploying BrunoRAG for domain: $DOMAIN"

# --- 1. Install Docker & Docker Compose (if missing) ---
if ! command -v docker &>/dev/null; then
    echo "==> Installing Docker..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

echo "==> Docker version: $(docker --version)"

# --- 2. Replace domain placeholder in nginx config ---
echo "==> Setting domain to $DOMAIN in nginx/nginx.conf..."
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" nginx/nginx.conf

# --- 3. Get initial SSL certificate with certbot (standalone) ---
echo "==> Obtaining Let's Encrypt certificate for $DOMAIN..."
# Stop anything on port 80 first
docker compose down 2>/dev/null || true

docker run --rm \
    -v "$(pwd)/certbot-conf:/etc/letsencrypt" \
    -v "$(pwd)/certbot-www:/var/www/certbot" \
    -p 80:80 \
    certbot/certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --register-unsafely-without-email \
        -d "$DOMAIN"

# Copy certs into the named volume by starting certbot service briefly
# (docker compose will mount the host path into the volume)
mkdir -p certbot-conf certbot-www

# --- 4. Start all services ---
echo "==> Building and starting containers..."
docker compose up -d --build

# --- 5. Set up automatic cert renewal via cron ---
CRON_CMD="0 3 * * * cd $(pwd) && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload"
if ! crontab -l 2>/dev/null | grep -qF "certbot renew"; then
    echo "==> Adding cert renewal cron job..."
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
fi

echo ""
echo "==> Deployment complete!"
echo "    Site: https://$DOMAIN"
echo "    Check status: docker compose ps"
echo "    View logs:    docker compose logs -f"
