# Entry Control System (ECS)

**Open-source, local-first access control and attendance management.**

Entry Control System (ECS) helps organizations manage attendance, staff and member records, access permissions, connected devices, and operational reporting. It originated in Kandahar, Afghanistan, where the product has been deployed for paying customers. This public repository makes the project's source and technical documentation available to developers and contributors.

**Status:** Actively developed. The repository includes working application features alongside experimental licensing, installer, and Windows hardening work. A successful source build or test is **not** proof of production installer, device, or licensing-security acceptance.

## What ECS offers

- **Attendance:** clock-in/clock-out events, shift and schedule rules, daily views, and attendance reports.
- **Access management:** member and staff records, access policies, entry/exit events, and administrative permissions.
- **Device integration:** ZKTeco K40 connection, user and attendance-log workflows, diagnostics, and documented hardware tests.
- **Operations:** audit trails, reporting/export workflows, backup management, and controlled restore procedures.
- **Full-edition workflows:** membership, payments, expenses, and payroll-related modules.
- **Two editions:** `FULL` and `ATTENDANCE`, with edition-specific capability boundaries.

Features and hardware support vary by edition and release gate. Consult the [project checklist](docs/project/PROJECT_CHECKLIST.md) and [attendance edition checklist](docs/project/ATTENDANCE_EDITION_CHECKLIST.md) for implementation and acceptance status.

## Technology

| Layer | Main technologies |
| --- | --- |
| Client | React 19, TypeScript, Vite, Tailwind CSS |
| API server | Node.js, Express 5, TypeScript, Zod |
| Data | PostgreSQL, Prisma 7 |
| Tests | Playwright, TypeScript and integration test scripts |
| Windows/licensing research | C#/.NET, native Windows experiments, versioned protocol and test vectors |

## Repository structure

```text
client/       React frontend and UI tests
server/       Express API, Prisma schema/migrations, backend tests
scripts/      Edition builds, verification and test tooling
licensing/    Protocol definitions, fixtures and experimental adapters
docs/         Architecture, project status, security and operations
version.json  Canonical product/build identity
```

## Local development (Windows PowerShell)

**Prerequisites:** Node.js **24.19.0** (the pinned repository version), npm, and a locally accessible PostgreSQL instance. Native Windows and certain licensing tests have additional platform/.NET requirements; see the documentation below.

1. Clone the repository and install dependencies:

```powershell
git clone https://github.com/ejnaseri/entry-control-system.git
cd entry-control-system
npm --prefix server ci
npm --prefix client ci
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

2. Create an **empty local development** PostgreSQL database and role. Edit `server/.env` to supply your own `DATABASE_URL` credentials instead of the `CHANGE_ME` example value. Keep device addresses and communication keys pointed at test hardware only. **Never commit `.env` or real customer information.**

3. Set up the database and start the API:

```powershell
cd server
npx prisma generate
npx prisma migrate deploy
npm run dev
```

4. In a second terminal, start the frontend:

```powershell
cd client
npm run dev
```

Vite prints the local frontend URL; the example client API endpoint is `http://localhost:4000`. These are source-level development steps, **not** a production installation guide. Review database migrations before running them, and never point these commands at a customer database.

## Edition builds and verification

From the repository root, using the pinned Node.js version and installed dependencies:

```powershell
npm run build:full
npm run build:attendance
npm run verify:full
npm run verify:attendance
npm run test:docs-links
npm run test:license-protocol-v1
npm run test:license-golden-vectors
```

Build outputs are separated into `release/FULL` and `release/ATTENDANCE`. The documented Phase 6.1 outputs are **unsigned development artifacts**, not a fully accepted Windows installer. Certain independent licensing checks require the pinned .NET SDK; see the [licensing documentation](docs/licensing/README.md).

## Documentation

- [Documentation index](docs/README.md)
- [Project progress and quality gates](docs/project/PROJECT_CHECKLIST.md)
- [Attendance edition progress](docs/project/ATTENDANCE_EDITION_CHECKLIST.md)
- [Security architecture](docs/architecture/security-design.md)
- [ZKTeco K40 hardware setup and test notes](docs/operations/k40-setup.md)
- [Local backup and restore policy](docs/operations/backup-restore.md)
- [Windows platform support matrix](docs/operations/WINDOWS_SUPPORT_MATRIX.md)
- [Licensing design, experiments and acceptance status](docs/licensing/README.md)
- [Licensing protocol v1](licensing/protocol/v1/README.md)

## Contributing

Bug reports, documentation improvements, tests, and well-scoped pull requests are welcome. Before proposing changes, check the linked project checklists and edition boundaries. Please avoid including real personal, biometric, customer, device-credential, or access-control data in public issues and test fixtures.

## Security and responsible use

ECS handles access-control and attendance information. Use **synthetic data and isolated test devices** when evaluating this source. Do not expose the development server directly to the internet or operate real door hardware from unreviewed development builds. If you find a potentially exploitable vulnerability, do not post secrets or exploitation details in a public issue; contact the maintainer to arrange a private report.

## License

Released under the [MIT License](LICENSE). Third-party dependencies retain their own licenses. Contributions and reuse must respect applicable privacy, hardware, and customer-data obligations.

**Maintainer:** [Eraj Naseri](https://github.com/ejnaseri)
