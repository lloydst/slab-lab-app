# Firebase and Cloud Run release runbook

SlabLab deploys the Angular frontend to Firebase Hosting and the NestJS API to Google Cloud Run. Firebase and Cloud Run must belong to the same Google Cloud project when Firebase Hosting proxies `/api/**` to Cloud Run.

This document deliberately uses placeholders. Do not add access tokens, service-account keys, API keys, passwords, `.env` contents, or copied CLI credential files to the repository.

## Prerequisites

- Node.js 24 LTS
- Docker
- Google Cloud CLI (`gcloud`)
- A Firebase project on the Blaze plan
- Permission to deploy Firebase Hosting and Cloud Run resources

Firebase CLI is run through `npx`; it does not need a global installation.

Set these shell variables for the current PowerShell session:

```powershell
$SLABLAB_PROJECT_ID = "YOUR_FIREBASE_PROJECT_ID"
$SLABLAB_REGION = "europe-west4"
$SLABLAB_SERVICE = "slablab-api"
```

The project ID and Cloud Run service name are resource identifiers, not credentials. Secrets still must not be placed in these variables in committed scripts or documentation.

## One-time Firebase setup

Authenticate and list the projects available to the account:

```powershell
npx firebase-tools login
npx firebase-tools projects:list
```

Create `.firebaserc` with the selected project ID:

```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

`firebase.json` points Hosting at the Angular browser build in `apps/web/dist/web/browser`. Do not run `firebase init hosting` over the existing configuration without reviewing the generated changes.

## Release the frontend

Run the project checks appropriate to the change, then build and deploy:

```powershell
npm run typecheck
npm test
npm run deploy:web
```

`deploy:web` builds the Angular application and invokes `npx firebase-tools deploy --only hosting`.

Verify the URL printed by Firebase:

```powershell
Invoke-WebRequest "https://YOUR_FIREBASE_PROJECT_ID.web.app" -UseBasicParsing
```

Expect HTTP status `200`. Also open the application and exercise template preview plus SVG, PDF, and PNG export before considering the release complete.

## One-time Cloud Run setup

Authenticate, select the project, and enable the required services:

```powershell
gcloud auth login
gcloud config set project $SLABLAB_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

New Google Cloud projects can use the Compute Engine default service account for source builds without automatically granting it build permissions. Determine the account:

```powershell
$SLABLAB_BUILD_ACCOUNT = gcloud builds get-default-service-account
```

Grant only the purpose-built builder role; do not grant the broad Editor or Owner role:

```powershell
gcloud projects add-iam-policy-binding $SLABLAB_PROJECT_ID `
  --member="serviceAccount:$SLABLAB_BUILD_ACCOUNT" `
  --role="roles/run.builder"
```

IAM changes can take a few minutes to propagate.

## Release the backend

Build and test the image locally first:

```powershell
docker build --tag slablab-api:release .
docker run --rm --detach --name slablab-api-check --publish 3100:8080 slablab-api:release
Invoke-RestMethod "http://localhost:3100/api/health"
docker stop slablab-api-check
```

The health response should report `status: ok`. Deploy the source using the repository Dockerfile:

```powershell
gcloud run deploy $SLABLAB_SERVICE `
  --project $SLABLAB_PROJECT_ID `
  --source . `
  --region $SLABLAB_REGION `
  --allow-unauthenticated `
  --min 0 `
  --max 3 `
  --memory 512Mi `
  --cpu 1 `
  --port 8080
```

`--min 0` permits scale-to-zero. `--max 3` limits unexpected scaling cost. Public ingress permits browser access, but sensitive API routes must still enforce application authentication and authorization.

Verify the service URL returned by Cloud Run:

```powershell
$SLABLAB_API_URL = gcloud run services describe $SLABLAB_SERVICE `
  --project $SLABLAB_PROJECT_ID `
  --region $SLABLAB_REGION `
  --format="value(status.url)"

Invoke-RestMethod "$SLABLAB_API_URL/api/health"
```

## Route Firebase Hosting to the API

After the Cloud Run service exists, place the API rewrite before the Angular fallback in `firebase.json`:

```json
{
  "hosting": {
    "public": "apps/web/dist/web/browser",
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "slablab-api",
          "region": "europe-west4"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

Deploy Hosting again, then verify the proxied endpoint:

```powershell
npm run deploy:web
Invoke-RestMethod "https://YOUR_FIREBASE_PROJECT_ID.web.app/api/health"
```

## Secrets

The current health-only backend requires no application secrets. Future AI provider keys must be stored in Google Secret Manager and attached to Cloud Run at deployment time. Never put them in:

- Angular environment files
- `firebase.json` or `.firebaserc`
- Docker images or Docker build arguments
- committed `.env` files
- GitHub workflow YAML
- issue descriptions, logs, screenshots, or release documentation

Example using a placeholder value supplied interactively rather than committed:

```powershell
gcloud secrets create AI_PROVIDER_API_KEY --replication-policy="automatic"
"PASTE_SECRET_INTERACTIVELY" | gcloud secrets versions add AI_PROVIDER_API_KEY --data-file=-
```

Grant the Cloud Run runtime service account access only to the required secret, then reference the secret with Cloud Run's `--set-secrets` option. Avoid printing secret values during verification.

Firebase web configuration values such as `projectId`, `authDomain`, and the Firebase browser API key identify the Firebase application and are normally delivered to browsers. They are not a substitute for Firestore Security Rules, Firebase Authentication, App Check, backend authorization, or API restrictions.

## Rollback

Firebase Hosting releases can be reviewed and rolled back from the Firebase console under Hosting.

List Cloud Run revisions:

```powershell
gcloud run revisions list `
  --project $SLABLAB_PROJECT_ID `
  --service $SLABLAB_SERVICE `
  --region $SLABLAB_REGION
```

Route traffic back to a known-good revision:

```powershell
gcloud run services update-traffic $SLABLAB_SERVICE `
  --project $SLABLAB_PROJECT_ID `
  --region $SLABLAB_REGION `
  --to-revisions="KNOWN_GOOD_REVISION=100"
```

Do not delete failed or old resources during incident response until logs and the working rollback have been verified.
