# Hostinger Deployment Guide: WhatsApp SaaS Platform

This guide covers deploying your platform (React Frontend + FastAPI Backend) to a Hostinger VPS.

## 1. Prerequisites
- A Hostinger VPS running **Ubuntu 22.04** (recommended).
- Domain name pointed to your VPS IP.
- SSH access to your VPS.

---

## 2. Server Setup

Connect to your server:
```bash
ssh root@your_vps_ip
```

Update system and install dependencies:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv nginx git curl
```

Install Node.js (via NVM):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

Install PM2 (Process Manager):
```bash
npm install -g pm2
```

---

## 3. Backend Deployment (FastAPI)

1. **Clone the code**:
   ```bash
   cd /var/www
   git clone https://github.com/your-repo/whatsapp-main.git
   cd whatsapp-main/backend
   ```

2. **Setup Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   pip install gunicorn uvicorn
   ```

3. **Configure Environment**:
   Create a `.env` file in the `backend` folder and copy your local values:
   ```bash
   nano .env
   ```
   *Make sure `MONGO_URL` points to your production DB (e.g., MongoDB Atlas).*

4. **Start Backend with PM2**:
   ```bash
   pm2 start "venv/bin/gunicorn --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 server:app" --name whatsapp-api
   ```

---

## 4. Frontend Deployment (React)

1. **Build locally** (on your computer):
   ```bash
   cd frontend
   npm run build
   ```

2. **Upload Build Files**:
   Use SCP or FTP to upload the contents of the `frontend/build` folder to `/var/www/whatsapp-main/frontend/build` on your server.

   *Command to upload from local:*
   ```bash
   scp -r ./build/* root@your_vps_ip:/var/www/whatsapp-main/frontend/build
   ```

---

## 5. Nginx Configuration

Create a new Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/whatsapp-platform
```

Paste the following config (replace `yourdomain.com`):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/whatsapp-main/frontend/build;
        index index.html;
        try_files $uri /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:8000/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhooks Proxy
    location /webhooks {
        proxy_pass http://localhost:8000/api/webhooks;
        proxy_set_header Host $host;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. SSL (HTTPS) - Critical for Meta Webhooks

Meta requires HTTPS for webhooks. Install Certbot (Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## 7. MongoDB Setup
If you are not using MongoDB Atlas, install it on your VPS:
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

---

## Troubleshooting
- **Check Backend Logs**: `pm2 logs whatsapp-api`
- **Check Nginx Logs**: `sudo tail -f /var/log/nginx/error.log`
- **Check Firewall**: Ensure ports 80 and 443 are open: `sudo ufw allow 'Nginx Full'`
