# AWS Deployment Guide — TN Election Dashboard

This is a self-contained, copy-paste guide for deploying the dashboard
to AWS as a hot standby (or eventual primary). Written so a teammate
can follow it without back-and-forth.

**Time budget:** ~90 min for App Runner path, ~3 hr for ECS Fargate path.
**Recommended path:** **App Runner** for the first deploy (simplest).

---

## ⚠️ READ FIRST — HTTPS, or the login is broken

The session cookie is set with `Secure=true` in production by default
(NODE_ENV=production), which means browsers **silently drop the cookie
over plain HTTP**. Login looks like 200 OK in curl, but in a browser
the user just bounces back to /login forever.

You must do ONE of:

1. **HTTPS in front** (recommended for production) — ALB + ACM cert,
   or Cloudflare proxy in front of the EC2 IP.
2. **Set `INSECURE_COOKIES=1`** in the container env — keeps
   NODE_ENV=production but downgrades the cookie to non-Secure so HTTP
   testing works. Don't use in real production with real users.

Either way, also set `SameSite=lax` is already configured — no further
cookie work needed beyond this.

## ⚠️ READ NEXT — SQLite persistence

The dashboard uses **SQLite** at `DB_PATH` (defaults to `/data/tn.db`).
That path **must be a persistent volume** on every host that should
keep state across container restarts. There is no Postgres / RDS
fallback in the codebase.

| Option | Persistent? | When to use |
|---|---|---|
| **App Runner default** | ❌ No | Read-only standby — Railway stays primary, AWS only used if Railway dies. Container is rebuilt with a fresh DB snapshot baked in (§5). |
| **App Runner + Litestream sidecar** | ✅ via S3 | App Runner as primary. ~2 hrs setup. Continuously replicates SQLite WAL to S3, restores on container start. |
| **ECS Fargate + EFS mount at `/data`** | ✅ Yes | Standard AWS pattern, full persistence, integrates with VPC. ~3 hr setup (§4). |
| **Lightsail Containers + attached disk** | ✅ Yes | Simpler than ECS, similar persistence, lower cost. Good middle ground. |

**For the counting-day backup:** pick **App Runner default + scheduled
DB snapshot push** (§5). Lowest setup risk, sufficient for read-only
standby.

**For AWS-as-primary post-counting:** pick **ECS Fargate + EFS** (§4)
or migrate the codebase to Postgres first.

Don't ship a writable App Runner deployment without one of the
persistent options — the SQLite DB will be wiped on every redeploy or
container restart and you'll lose vote data.

---

## 0. Prerequisites

You'll need:

1. **AWS account** with admin or PowerUser access.
2. **AWS CLI v2** installed and configured (`aws configure`).
3. **Docker** installed locally (to build and push the image).
4. A copy of the **production secrets** (ask Prakash):
   - `SESSION_SECRET` — 32-byte hex string
   - `AUTH_NAADHAS_PASSWORD`
   - `AUTH_AADHAN_PASSWORD`
   - `ADMIN_TOKEN` (optional but recommended)
5. A **fresh DB snapshot from Railway** to seed the AWS volume — see §6.

Pick a region. Recommendation: **`ap-south-1` (Mumbai)** for India latency.

```bash
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account: $AWS_ACCOUNT_ID, Region: $AWS_REGION"
```

---

## 1. Build the Docker image

From the repo root (`tn-election-results/`).
**Note the `-f Dockerfile.aws` flag** — Railway uses Nixpacks, so this
repo deliberately keeps the Dockerfile under a non-default name so
Railway doesn't accidentally pick it up.

```bash
docker build -t tn-election-results:latest -f Dockerfile.aws .
```

This takes ~3 minutes the first time (better-sqlite3 native compile is
the slow step). Test it locally to confirm before pushing:

```bash
docker run --rm -p 3000:3000 \
  -v $(pwd)/data:/data \
  -e SESSION_SECRET=local-dev-only \
  -e AUTH_NAADHAS_PASSWORD=test \
  -e AUTH_AADHAN_PASSWORD=test \
  tn-election-results:latest
```

Hit `http://localhost:3000` — if the broadcast page loads, the image is
good.

---

## 2. Push to Amazon ECR

Create the registry once:

```bash
aws ecr create-repository \
  --repository-name tn-election-results \
  --region $AWS_REGION
```

Authenticate Docker with ECR, then tag and push:

```bash
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker tag tn-election-results:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tn-election-results:latest

docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tn-election-results:latest
```

---

## 3. Path A — AWS App Runner (recommended, ~30 min)

**Why App Runner:** single container, auto HTTPS, auto-scaling, no ALB
or VPC config to manage. Trade-off: no native EFS support — see §3.4 for
the SQLite persistence workaround.

### 3.1 Store secrets in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name tn-dashboard/SESSION_SECRET \
  --secret-string "$(openssl rand -hex 32)"

aws secretsmanager create-secret \
  --name tn-dashboard/AUTH_NAADHAS_PASSWORD \
  --secret-string "the-real-naadhas-password"

aws secretsmanager create-secret \
  --name tn-dashboard/AUTH_AADHAN_PASSWORD \
  --secret-string "the-real-aadhan-password"
```

### 3.2 Create an IAM role App Runner can assume to read those secrets

Save this trust policy as `apprunner-trust.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "tasks.apprunner.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

```bash
aws iam create-role \
  --role-name AppRunnerTNDashboardRole \
  --assume-role-policy-document file://apprunner-trust.json

aws iam attach-role-policy \
  --role-name AppRunnerTNDashboardRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

Also create the **access role** for ECR:

Save as `apprunner-access-trust.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "build.apprunner.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

```bash
aws iam create-role \
  --role-name AppRunnerECRAccessRole \
  --assume-role-policy-document file://apprunner-access-trust.json

aws iam attach-role-policy \
  --role-name AppRunnerECRAccessRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
```

### 3.3 Create the App Runner service

Use the AWS Console — it's faster than CLI for first-time setup:

1. **AWS Console → App Runner → Create service**
2. **Source:** Container registry → ECR
3. **Container image URI:** `<account>.dkr.ecr.<region>.amazonaws.com/tn-election-results:latest`
4. **Deployment trigger:** Manual (you control rollouts)
5. **ECR access role:** `AppRunnerECRAccessRole`
6. **Service name:** `tn-dashboard-prod`
7. **Virtual CPU:** 1 vCPU, **Memory:** 2 GB (upgrade to 4 GB if you see OOM under load)
8. **Port:** 3000
9. **Environment variables (from Secrets Manager):**
   - `SESSION_SECRET` → arn of secret created in §3.1
   - `AUTH_NAADHAS_PASSWORD` → arn
   - `AUTH_AADHAN_PASSWORD` → arn
   - `DB_PATH` → `/data/tn.db` (plain value)
10. **Instance role:** `AppRunnerTNDashboardRole`
11. **Health check:** Path `/api/results`, healthy threshold 1, unhealthy 3
12. **Auto-scaling:** Min 1, Max 3 (counting day spike protection)

### 3.4 Persistence trade-off (READ THIS)

App Runner does **not** support persistent volumes natively. The SQLite
DB inside the container is **ephemeral** — it dies on every redeploy or
container restart.

You have three options, pick one:

- **(a) Stateless mode — recommended for AWS-as-standby:** treat the AWS
  instance as read-only. Don't run admin actions or scraper writes
  against it. The Railway primary remains the source of truth; AWS only
  serves cached read data when Railway is down.
- **(b) Litestream replication (best for AWS-as-primary):** wrap the
  container with [Litestream](https://litestream.io/) to continuously
  replicate the SQLite DB to S3. Restore on container start. Requires a
  custom entrypoint script. About 2 hours to set up properly.
- **(c) Switch from SQLite to RDS Postgres:** the principled answer if
  you make AWS primary long-term. Out of scope for the counting-day
  backup plan — track as follow-up work.

For the counting-day standby, **pick (a)**. It's simpler and removes
risk: Railway stays primary, AWS is a read-only failover URL.

### 3.5 Wire up DNS (optional, do later)

App Runner gives you a `https://xxxxxxxx.<region>.awsapprunner.com` URL
on creation. Test with that first. Once happy:

1. Route 53 → create A-record alias to the App Runner default domain
2. App Runner → Custom domains → add your domain → it issues an ACM cert
   automatically

For counting day, the default `awsapprunner.com` URL is fine — no need
to fight DNS.

---

## 4. Path B — ECS Fargate + EFS (full persistence, ~2.5 hr)

Pick this path if you want AWS as **primary** (writable, durable SQLite),
not just a read-only standby. EFS gives you true persistent storage
that survives container restarts and redeploys.

### 4.1 Create the EFS file system

```bash
# Get the default VPC + subnet info
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query "Subnets[].SubnetId" --output text)

# Create the file system
FS_ID=$(aws efs create-file-system \
  --creation-token tn-dashboard-data \
  --performance-mode generalPurpose \
  --throughput-mode bursting \
  --encrypted \
  --tags Key=Name,Value=tn-dashboard-data \
  --query "FileSystemId" --output text)
echo "Created EFS: $FS_ID"

# Allow NFS traffic from Fargate tasks
SG_ID=$(aws ec2 create-security-group \
  --group-name tn-dashboard-efs-sg \
  --description "EFS access for tn-dashboard" \
  --vpc-id $VPC_ID --query "GroupId" --output text)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID --protocol tcp --port 2049 \
  --source-group $SG_ID

# Create mount target in each subnet
for SUBNET in $SUBNET_IDS; do
  aws efs create-mount-target \
    --file-system-id $FS_ID \
    --subnet-id $SUBNET \
    --security-groups $SG_ID
done
```

Wait ~3 minutes for mount targets to become `available`:

```bash
aws efs describe-mount-targets --file-system-id $FS_ID \
  --query "MountTargets[].LifeCycleState"
```

### 4.2 Create an EFS access point (chowns to UID 1001 — the `app` user)

```bash
AP_ID=$(aws efs create-access-point \
  --file-system-id $FS_ID \
  --posix-user '{"Uid":1001,"Gid":1001}' \
  --root-directory '{"Path":"/data","CreationInfo":{"OwnerUid":1001,"OwnerGid":1001,"Permissions":"0755"}}' \
  --tags Key=Name,Value=tn-dashboard-data-ap \
  --query "AccessPointId" --output text)
echo "Created access point: $AP_ID"
```

### 4.3 Seed the DB into EFS (one-time)

You need the SQLite DB inside EFS before the first container starts.
Easiest way: launch a tiny EC2 instance in the same VPC, mount EFS,
copy the file in, terminate the instance.

```bash
# On a workstation: pull the latest DB from Railway
railway run cat /data/tn.db > tn-snapshot.db

# Launch a temporary EC2 (Amazon Linux 2023, t4g.nano)
# Attach the EFS via the same security group
# scp the DB up, ssh in, mount EFS, copy, unmount, terminate
```

Detailed seed script: `scripts/aws-efs-seed.sh` (TODO — write if needed).
Alternatively run the dashboard once with an empty volume and let
`scripts/seed-if-empty.ts` populate it from `data/candidates-real.json`.

### 4.4 Register the ECS task definition

A working task definition is in [aws-fargate-task-def.json](aws-fargate-task-def.json).
Edit the placeholders (account ID, region, secret ARNs, EFS file system
ID, access point ID) and register:

```bash
aws ecs register-task-definition \
  --cli-input-json file://docs/aws-fargate-task-def.json
```

### 4.5 Create the ALB + service

```bash
# ALB on port 80/443 forwarding to target group on 3000
# Target group with /api/results health check
# ECS cluster (Fargate launch type)
# Service with desired count = 1, attached to the target group
```

Use the AWS Console wizard for this — it's faster than CLI for
first-time setup. Pick:

- Cluster: `tn-dashboard-cluster` (Fargate)
- Service: `tn-dashboard-service`
- Task definition: the one you just registered
- Load balancer: new ALB, target port 3000
- Health check path: `/api/results`
- Subnets: the same ones EFS is mounted in
- Security groups: include `$SG_ID` from §4.1 so the task can reach EFS

Once the service shows `RUNNING`, hit the ALB DNS name to confirm.

---

## 5. Sync the database from Railway → AWS (one-time seed)

If you go with §3.4(a) (read-only standby), you still need a recent DB
snapshot inside the AWS container so the dashboard isn't empty.

From a workstation with the Railway CLI:

```bash
railway run cat /data/tn.db > tn-snapshot.db
```

Then bake the snapshot into a new image and redeploy:

```bash
cp tn-snapshot.db data/tn.db
docker build -t tn-election-results:snapshot-$(date +%Y%m%d) -f Dockerfile.aws .
docker tag tn-election-results:snapshot-$(date +%Y%m%d) \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tn-election-results:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tn-election-results:latest
# Trigger an App Runner deployment
aws apprunner start-deployment --service-arn <your-service-arn>
```

For a hot standby on counting day, run this **every 15 minutes** via a
scheduled job on the Bangalore droplet (cron + a small bash script).

---

## 6. Pre-flight checklist before flipping traffic

- [ ] App Runner status: **Running** (green in console)
- [ ] Custom URL or default URL responds 200 on `/api/results`
- [ ] `/login` accepts the production passwords
- [ ] `/broadcast?live=1` renders the cards (after sign-in)
- [ ] `/broadcast/admin` shows the slot mixer with the right tenant
- [ ] OBS browser source pre-configured pointing at the AWS URL,
      currently disabled
- [ ] Database snapshot is from the **last 15 min** (not stale)

---

## 7. Failover procedure (counting day)

If Railway becomes unreachable:

1. **OBS operator:** disable Railway browser source, enable AWS
   browser source. ~5 second swap, no DNS, no waiting.
2. **Anchor:** continue narrating; the failover should be invisible on
   air if data freshness is < 15 min.
3. **Engineer:** confirm AWS is taking traffic via App Runner request
   logs. If AWS is also misbehaving, fall back to the droplet (third
   browser source) and then to manual narration from the printed cheat
   sheet.

---

## 8. Cost estimate

App Runner: ~$0.064/vCPU-hr + $0.007/GB-hr. With 1 vCPU + 2 GB RAM
running 24/7: roughly **$60/month**. ECR storage + Secrets Manager add
~$2/month. Acceptable for a high-availability tier; turn the service
to "pause" when not in use to save money between elections.

---

## 9. Rollback

To delete everything:

```bash
aws apprunner delete-service --service-arn <arn>
aws ecr delete-repository --repository-name tn-election-results --force
aws secretsmanager delete-secret --secret-id tn-dashboard/SESSION_SECRET --force-delete-without-recovery
# repeat for the other secrets
aws iam detach-role-policy --role-name AppRunnerTNDashboardRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
aws iam delete-role --role-name AppRunnerTNDashboardRole
aws iam detach-role-policy --role-name AppRunnerECRAccessRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
aws iam delete-role --role-name AppRunnerECRAccessRole
```

---

## 10. Troubleshooting

**Image won't push to ECR:** re-run the `aws ecr get-login-password`
step — the token is short-lived (~12 hrs).

**App Runner deploy stuck in `OPERATION_IN_PROGRESS`:** check the
Application logs in the console. Most common: missing env var, or
SESSION_SECRET shorter than expected.

**`/api/results` returns 500:** SQLite path is wrong or volume isn't
mounted. Check `DB_PATH` env var matches the volume mount point.

**Hydration mismatch errors in browser console:** this is the existing
`toLocaleString("en-IN")` issue if any new code introduced it. Production
build is fine; only dev mode shows the warning.

**Slow first request after a deploy:** App Runner cold-starts the
container if it scaled to zero. Set min instances ≥ 1 in production.

---

## 11. Operational notes

- **Logs:** App Runner sends container stdout to CloudWatch Logs
  automatically. Find them under `/aws/apprunner/<service-name>`.
- **Metrics:** App Runner exposes CPU, memory, request count,
  latency, and 4xx/5xx rates in CloudWatch.
- **Updates:** redeploy by `docker push`-ing a new `:latest` tag and
  triggering `aws apprunner start-deployment`. Rolling deploy is
  automatic with zero downtime when min-instances ≥ 1.
- **Secrets rotation:** update the Secrets Manager value, then
  trigger a new App Runner deployment to pick it up.
