# Sourcify Contract Viewer

A Next.js application for viewing verified smart contract details from the Sourcify API.

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn
- Docker (optional, for containerized deployment)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
SOURCIFY_SERVER_URL=https://sourcify.dev/server
```

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

1. Build the Docker image:

   ```bash
   docker build -t repo-sourcify .
   ```

2. Run the container:

   ```bash
   docker run -p 3000:3000 -e SOURCIFY_SERVER_URL=https://sourcify.dev/server sourcify-contract-viewer
   ```

3. Access the application at [http://localhost:3000](http://localhost:3000).
