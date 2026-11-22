# Deploying Texflow with GitHub Actions

Texflow is a Node server with a TeX Live installation behind it, so it needs a host that runs containers. GitHub Pages serves static files only and cannot run the compiler or the API. GitHub Actions does the building and delivery instead.

## What the workflows do

| Workflow | Trigger | Steps |
| --- | --- | --- |
| `ci.yml` | pull requests, reused by deploy | backend tests, client build, Docker image build, container smoke test |
| `deploy.yml` | push to `main`, tags `v*.*.*`, manual run | CI, publish image to GitHub Container Registry, optional deploy over SSH |

Published image: `ghcr.io/<owner>/<repo>` with tags `latest`, `sha-<commit>`, and `1.2.3` / `1.2` for release tags.

The container smoke test starts the image with a read-only filesystem and no capabilities, registers a user, compiles the example project and checks that a real PDF comes back.

## Option A: pull the published image

After the first run on `main`, in the repository go to **Packages** and set the `texflow` package visibility as you prefer. Then on any Docker host:

```bash
docker run -d --name texflow -p 3001:3001 -v texflow-data:/data \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  ghcr.io/<owner>/<repo>:latest
```

Put a TLS reverse proxy in front and set `TRUST_PROXY=1`.

## Option B: automatic deploy to your own server

The deploy job connects over SSH, copies `deploy/docker-compose.yml` and `deploy/Caddyfile`, pulls the new image and restarts the stack. Caddy obtains HTTPS certificates automatically.

### 1. Prepare the server once

1. Install Docker with the Compose plugin.
2. Point a DNS A record for your domain at the server and open ports 80 and 443.
3. Create the deploy directory and environment file:

```bash
sudo mkdir -p /opt/texflow && sudo chown "$USER" /opt/texflow
cat > /opt/texflow/.env <<'ENV'
DOMAIN=texflow.example.com
# ALLOW_REGISTRATION=false
# TEXFLOW_TAG=latest
ENV
```

4. Create a dedicated SSH key pair for deployments and add the public key to `~/.ssh/authorized_keys` of a user that can run Docker.

### 2. Configure the repository

Under **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `DEPLOY_ENABLED` | `true` |
| Variable | `DEPLOY_URL` | `https://texflow.example.com` (health check after deploy) |
| Variable | `DEPLOY_PATH` | optional, default `/opt/texflow` |
| Secret | `DEPLOY_HOST` | server address |
| Secret | `DEPLOY_USER` | SSH user |
| Secret | `DEPLOY_SSH_KEY` | private key |
| Secret | `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -H <host>` |

Create an environment named `production` if you want required reviewers on deploys.

If the image package is private, the job logs the server in to GHCR with the workflow token for the duration of the pull and logs out afterwards.

### 3. Push

Every push to `main` now tests, builds, publishes and deploys. Until `DEPLOY_ENABLED` is `true`, only the test and publish jobs run.

## Other hosts

Any platform that builds a Dockerfile (Fly.io, Railway, Render, a Kubernetes cluster) can run the same image. Mount persistent storage at `/data`, expose port 3001, and set `TRUST_PROXY=1`.

## Extra TeX packages

The image includes the common scientific, TikZ, publisher and XeLaTeX collections. To add more, build with `--build-arg TEX_EXTRA="texlive-lang-european"`.

## Backups

All state is in the `texflow-data` volume (SQLite database and project files). Back it up while the container is stopped, or copy the SQLite file with `sqlite3 .backup`.
