# Sourcify Contract Viewer

A Next.js application for viewing verified smart contract details from the Sourcify API.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- Docker (optional, for containerized deployment)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
SOURCIFY_SERVER_URL=https://sourcify.dev/server
SOURCIFY_SERVER_INTERNAL_URL=https://sourcify.dev/server
# NODE_ENV=development or NODE_ENV=production
```

- `SOURCIFY_SERVER_URL`: the public URL of the Sourcify server. The browser uses it (similarity verification) and so do redirects, so it must be reachable from the internet.
- `SOURCIFY_SERVER_INTERNAL_URL`: the URL the Next.js server uses for its own calls to the Sourcify server (contract pages are rendered server-side). Locally this is just the public URL again. In production it must be the Sourcify server's direct service URL (its Cloud Run `*.run.app` URL, without the `/server` path prefix) so the traffic stays inside the network instead of leaving and re-entering through the public load balancer, where a per-IP rate limit would put every visitor's page view in one shared bucket. Both are required and checked in `next.config.ts`, so `next build` and `next dev` fail immediately when one is missing. Pass both at build time (the growthepie top-contracts route is pre-rendered during `next build`) and at runtime, in every environment that builds the app: Cloud Build, Netlify deploy previews, local `.env`.

### Running Locally

1. Clone the repository:

   ```bash
   git clone https://github.com/sourcifyeth/repo.sourcify.dev.git
   cd repo.sourcify.dev
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

```bash
npm run build
npm start
# or
yarn build
yarn start
```

## Docker Deployment

The project includes a Dockerfile based on the official Next.js Docker example.

### Building and Running with Docker

Keep in mind you need to pass the `SOURCIFY_SERVER_URL` as a build argument. The way to pass this might differ depending on your build platform. In Google Cloud Build, you need to pass it as a value to be substituted in your `cloudbuild.yaml` file:

```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - "--build-arg"
      - "SOURCIFY_SERVER_URL=${_SOURCIFY_SERVER_URL}"
      - "--build-arg"
      - "SOURCIFY_SERVER_INTERNAL_URL=${_SOURCIFY_SERVER_INTERNAL_URL}"
---
substitutions:
  _SOURCIFY_SERVER_URL: https://sourcify.dev/server
  _SOURCIFY_SERVER_INTERNAL_URL: https://<sourcify-server-service>.a.run.app
```

1. Build the Docker image:

   ```bash
   # Build the image with the Sourcify server URL as a build argument
   docker build --build-arg SOURCIFY_SERVER_URL=https://sourcify.dev/server --build-arg SOURCIFY_SERVER_INTERNAL_URL=https://sourcify.dev/server -t repo-sourcify .
   ```

2. Run the container:

   ```bash
   docker run -p 3000:3000 -e SOURCIFY_SERVER_URL=https://sourcify.dev/server -e SOURCIFY_SERVER_INTERNAL_URL=https://sourcify.dev/server repo-sourcify
   ```

3. Access the application at [http://localhost:3000](http://localhost:3000).
