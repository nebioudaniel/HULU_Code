# huluCode

**Understand your codebase. Map every connection. Ask questions about your code.**

huluCode is a local-first AI codebase navigator that helps developers understand, explore, and analyze their projects. It scans code locally, maps relationships between files and symbols, and enables developers to ask questions about their codebase.

Privacy is at the core of huluCode. Project synchronization is designed to transmit structural metadata rather than source code or file contents.

## Features

- **Local Codebase Scanning:** Analyze project structure directly on your machine.
- **Code Intelligence:** Extract symbols, imports, dependencies, and relationships across files.
- **Dependency Mapping:** Understand how files and components connect throughout a project.
- **AI-Powered Queries:** Ask questions about your codebase and explore relevant project information.
- **Project Dashboard:** Manage projects, review usage statistics, and access codebase queries.
- **GitHub Authentication:** Sign in using GitHub OAuth.
- **API Key Management:** Manage authentication credentials for CLI and API access.
- **Usage Tracking:** Monitor activity and subscription limits.
- **Free and Pro Plans:** Access features according to your subscription.
- **Payment Integration:** Support Pro subscriptions through Chapa's hosted checkout.
- **Privacy-First Architecture:** Synchronize structural metadata without uploading source code or file contents.

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | Web application and API routes |
| React 19 | Interactive user interface |
| TypeScript | Type-safe development |
| Tailwind CSS 4 | Styling and responsive layouts |
| shadcn/ui | UI components |
| Radix UI | Accessible interface primitives |
| Auth.js | Authentication and GitHub OAuth |
| Go | CLI and backend services |
| Cobra | CLI command management |
| Tree-sitter | Source-code parsing |
| PostgreSQL | Database |
| pgvector | Vector-enabled database support |
| Neon | Serverless PostgreSQL hosting |
| Chapa | Payment processing |
| Docker | Containerization |
| Cloudflare Workers | Deployment infrastructure |

## Architecture

huluCode consists of four main components.

### 1. Local CLI

The Go-based CLI scans projects locally, parses supported source files, and extracts structural information such as symbols, imports, file relationships, and external dependencies.

### 2. Web Application

The Next.js application provides the user interface for authentication, project management, codebase queries, usage tracking, billing, and account settings.

### 3. API

The application exposes endpoints for authentication validation and project synchronization.

- `POST /api/v1/auth/validate`
- `POST /api/v1/projects/sync`

### 4. Database

PostgreSQL stores application data and synchronized project metadata. Production deployments can use Neon, while local development can use PostgreSQL with pgvector.

### System Overview

```text
Developer's Machine
        |
        v
    huluCode CLI
        |
        | Local scanning and parsing
        | Structural metadata synchronization
        v
    huluCode API
        |
        v
 PostgreSQL + pgvector
        |
        v
   Web Dashboard
        |
        +-- Projects
        +-- Codebase Queries
        +-- Usage and Billing
        +-- Account Settings
```

## Getting Started

### Prerequisites

- Node.js 20 or later
- Go 1.22 or later for CLI development
- PostgreSQL with the vector extension
- Git
- A GitHub OAuth application
- Chapa credentials for payment functionality

### Installation

Clone the repository:

```bash
git clone https://github.com/nebioudaniel/HULU_Code.git
cd HULU_Code
```

Install dependencies:

```bash
npm install
```

Configure environment variables:

```bash
cp .env.example .env
```

Update `.env` with your database credentials, authentication secrets, and other required configuration.

Apply the database migrations to a fresh local database according to the repository's migration instructions.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Verify the location of `package.json` and the migration filenames before running these commands. Do not apply fresh-database migrations blindly to an existing production database.

## Environment Variables

Configure the following variables in your `.env` file.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_DRIVER` | Database driver selection |
| `AUTH_SECRET` | Secret used to sign authentication session data |
| `AUTH_GITHUB_ID` | GitHub OAuth application client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth application client secret |
| `CHAPA_SECRET_KEY` | Chapa API secret for payment operations |
| `CHAPA_WEBHOOK_SECRET` | Secret used to verify payment webhook signatures |
| `NEXT_PUBLIC_APP_URL` | Public application URL |
| `ENABLE_DEMO_UPGRADE` | Enables local demonstration upgrades; keep disabled in production |

Generate an authentication secret:

```bash
openssl rand -base64 32
```

For local GitHub OAuth development, configure the callback URL:

```text
http://localhost:3000/api/auth/callback/github
```

Never commit real credentials, API keys, or production secrets to version control.

## Run with Docker

Start the application using Docker Compose:

```bash
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000) when the application is ready.

Check running containers:

```bash
docker compose ps
```

View application logs:

```bash
docker compose logs -f
```

Review the Docker configuration and migration instructions before connecting to an existing database.

## CLI Requirements

The CLI uses Go and native build tools where required.

- **Go:** Version 1.22 or later.
- **macOS:** Xcode Command Line Tools.
- **Linux:** GCC or another supported native build toolchain.

Verify your installation:

```bash
go version
gcc --version
```

## Privacy and Security

Privacy is a core design principle of huluCode.

Code analysis is performed locally, and project synchronization is designed to transmit structural metadata rather than source code.

Depending on the scanning and synchronization configuration, metadata may include:

- Project names and repository content hashes.
- Relative file paths, programming languages, and line counts.
- Symbol names, kinds, relationships, and source locations.
- Import relationships and external dependency information.
- Structural identifiers and content hashes.

The synchronization process is designed not to transmit:

- Source code or complete file contents.
- Absolute local filesystem paths.
- Files identified as containing secrets or credentials.
- API keys, access tokens, or database connection strings.

Review the CLI's file filtering, metadata extraction, synchronization requests, and logging before using huluCode with confidential repositories.

## Project Structure

```text
HULU_Code/
├── .github/
│   └── workflows/
├── app/
│   ├── api/
│   └── dashboard/
├── backend/
├── cli/
├── components/
├── docs/
├── hooks/
├── lib/
├── migrations/
├── public/
│   └── logos/
├── types/
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## Deployment

huluCode can be configured for deployment using Docker and Cloudflare Workers with the OpenNext adapter.

Before deploying:

1. Configure production environment variables and secrets.
2. Set up the production PostgreSQL database.
3. Configure GitHub OAuth callback URLs.
4. Configure Chapa credentials and webhook verification.
5. Apply database migrations using a controlled deployment process.
6. Verify authentication, API access, project synchronization, and billing.
7. Review `docs/DEPLOY_CLOUDFLARE.md`.

Test payment processing in the appropriate environment before enabling real transactions.
## Screenshots

### Main Page 
<img width="1676" height="1094" alt="Screenshot 2026-10-27 at 10 34 05 AM" src="https://github.com/user-attachments/assets/9f7a6a3a-d797-484c-a950-1fe4eb04929d" />

### Dashboard 
<img width="1676" height="1094" alt="Screenshot 2026-10-27 at 10 35 13 AM" src="https://github.com/user-attachments/assets/54c1bf57-7056-46dd-acf5-14a83f30bb3d" />

### Projects Page 

<img width="1676" height="1094" alt="Screenshot 2026-10-27 at 10 35 56 AM" src="https://github.com/user-attachments/assets/a16febe4-cb9f-48a8-9b82-282a2c97f285" />

### Billing Page 

<img width="1676" height="1094" alt="Screenshot 2026-10-27 at 10 36 36 AM" src="https://github.com/user-attachments/assets/6635997d-bf40-4c78-b10b-c1fa2d57f4fa" />

## Contributing

Contributions, bug reports, and suggestions are welcome.

When contributing:

- Follow the existing project structure.
- Keep changes focused and well documented.
- Test changes before submitting them.
- Never commit credentials or sensitive project data.

## Security

Please report security vulnerabilities responsibly. See [SECURITY.md](SECURITY.md) for the project's security policy.

## License

huluCode is released under the MIT License. See [LICENSE](LICENSE) for details.

## Author

**Nebyiou Daniel**

GitHub: [@nebioudaniel](https://github.com/nebioudaniel)

---

**huluCode — Your codebase, understood.**

