# Mobee Backend Production Deployment

## Production layout

- API: `https://api.suite.mobee.lk`
- Health check: `https://api.suite.mobee.lk/api/v1/health`
- Application root: `/www/projects/MobileBee-Backend`
- Shared production environment: `/www/projects/MobileBee-Backend/.env`
- Active release: `/www/projects/MobileBee-Backend/current`
- Release history: `/www/projects/MobileBee-Backend/releases/<git-sha>`
- PM2 process: `mobilebee-backend`

The production `.env` is shared by symlink and is never copied into GitHub or a release artifact.

## GitHub setup

Create a GitHub environment named `production` in the backend repository. Add a required reviewer when the repository plan supports it.

Add these environment secrets:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS hostname or IP address |
| `VPS_PORT` | SSH port, normally `22` |
| `VPS_USER` | Current deployment user, currently `root` |
| `VPS_SSH_PRIVATE_KEY` | Private half of the dedicated deployment key |
| `VPS_KNOWN_HOSTS` | Trusted `known_hosts` line for the VPS |

Generate a dedicated key on an administrator computer:

```bash
ssh-keygen -t ed25519 -C "github-actions-mobee" -f mobee_github_actions
```

Append `mobee_github_actions.pub` to the deployment user's `~/.ssh/authorized_keys`. Put the private file contents in `VPS_SSH_PRIVATE_KEY`. Generate the known-host entry from a trusted network and compare its fingerprint with the VPS before saving it:

```bash
ssh-keyscan -H -p 22 YOUR_VPS_HOST
```

Delete the private key file from the administrator computer after GitHub is configured, unless it is retained in an approved password manager.

## One-time VPS checks

```bash
test -f /www/projects/MobileBee-Backend/.env
mkdir -p /www/projects/MobileBee-Backend/releases
pm2 list
pm2 save
```

The first successful deployment creates the `current` symlink and adopts the existing PM2 process by its current name. Keep one PM2 instance until shared rate-limit/session state is moved to Redis or another shared store.

## Deployment flow

1. A pull request or push to `dev`/`main` runs type checking, identifier validation, TypeScript compilation, and a production Docker build.
2. A push to `main` waits for the `production` environment approval when configured.
3. GitHub uploads a release named with the commit SHA.
4. The VPS installs locked production dependencies with `npm ci --omit=dev`.
5. The `current` symlink changes atomically.
6. PM2 reloads `mobilebee-backend` and saves its process list.
7. Local and public health checks run.
8. A failed health check restores the previous symlink and reloads PM2 automatically.
9. The five newest releases are retained.

## Database deployment policy

Production database changes are deliberately not automatic. For each schema change:

1. Generate and review the Drizzle migration in the pull request.
2. Run `npm run db:check-identifiers` in CI.
3. Create a database backup before deployment.
4. Generate the reviewed SQL with `npm run db:migrate`.
5. Apply the approved SQL in MySQL Workbench during the release window.
6. Verify the database and API health endpoint.
7. Approve and deploy the application release.

Do not use `npm run db:push` against production.

## Manual operations

```bash
pm2 status mobilebee-backend
pm2 logs mobilebee-backend --lines 100
pm2 restart mobilebee-backend
curl -fsS https://api.suite.mobee.lk/api/v1/health
```

The workflow also supports a controlled manual run from GitHub Actions through `workflow_dispatch`.
