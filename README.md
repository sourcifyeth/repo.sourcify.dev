# Sourcify Contract Viewer

A Next.js application for viewing verified smart contract details from the Sourcify API.

## Features

- View contract details, ABI, source code, and bytecode on a single page
- Support for multiple blockchain networks with human-readable chain names
- Clean and responsive UI with Tailwind CSS
- Easy navigation between different contract sections
- Hybrid rendering approach for optimal performance and SEO

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/contract.sourcify.dev.git
cd contract.sourcify.dev
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

## Usage

1. On the home page, select a blockchain network from the dropdown menu.
2. Enter a contract address in the input field.
3. Click "View Contract" to see the contract details.
4. Scroll down to view all contract information including details, ABI, source code, and bytecode.

## API Integration

The application integrates with the Sourcify API to fetch contract data. The main API endpoints used are:

- `/server/v2/contract/{chainId}/{address}?fields=all` - Fetches all contract data including metadata, source files, and bytecode
- `/server/chains` - Fetches the list of supported blockchain networks with their details

## Deployment

### Deploying to Google Cloud

1. Install the Google Cloud SDK.
2. Build the application:

```bash
npm run build
# or
yarn build
```

3. Deploy to Google Cloud Run:

```bash
gcloud run deploy contract-sourcify-dev --source .
```

## Project Structure

- `src/app` - Next.js app router pages
- `src/components` - React components
- `src/types` - TypeScript type definitions
- `src/utils` - Utility functions

## Architecture

The application uses a hybrid rendering approach:

- **Server Components**: Initial data fetching happens on the server, improving performance and SEO.
- **Client Components**: Interactive elements are rendered on the client for a responsive user experience.
- **Suspense**: Used for smooth loading states during component transitions.
- **Caching**:
  - API responses for contract data are cached for 1 hour to reduce load on the Sourcify API.
  - Chains data is cached for 24 hours as it changes less frequently.

This architecture provides the best of both worlds - fast initial page loads with server-side rendering and rich interactivity with client-side components.

## License

MIT
