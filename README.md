# Entry Control System (ECS)

### Smart access control, membership validation & attendance management

**A fingerprint should do more than record attendance — it should help the system decide whether access is permitted.**

ECS is a **local-first, open-source access-control and management platform** built for real organizations, particularly gyms and fitness centers. It combines device events, membership and payment status, access policies, attendance records and operational dashboards in one system.

The project originated in **Kandahar, Afghanistan**, and has been deployed for multiple paying customers. This repository contains the public source code, tests and technical documentation.

> **Core idea:** Fingerprint / device event → Membership and policy validation → Access allowed or denied.
>

## Why ECS?

A conventional attendance terminal can tell you **who scanned**. A membership-aware access-control system must also answer:

- Does this person have a **valid, active membership**?
- Has the membership **expired**?
- Is there an **unpaid balance / debtor restriction**?
- Is the member **blocked or inactive**?
- Is access permitted on **this day, at this time**, under their policy?
- Should the system **allow entry, deny entry, record an event or trigger a compatible door relay**?

ECS brings these checks together rather than treating every fingerprint scan as permission to enter.

## How smart access decisions work

```text
        Fingerprint / device event
                    |
                    v
       Match device user to member
                    |
                    v
     Check membership and payment status
                    |
                    v
    Check access rules / permitted schedule
                    |
           +--------+--------+
           |                 |
           v                 v
      ACCESS ALLOWED     ACCESS DENIED
           |                 |
    Record event        Record rejection
           |            and its reason
    Trigger compatible
    door control
    when configured
```

The biometric matching happens on the **supported device**; ECS evaluates the mapped event against application data and policies. Actual physical door enforcement requires compatible, correctly configured hardware. Behavior differs between editions.

### Example: gym entry eligibility

| Member condition | Typical FULL-edition decision |
| --- | --- |
| Active membership, required payment completed, policy satisfied | ✅ Allow access |
| Expired or inactive membership | ❌ Deny access |
| Debtor / unpaid membership under the access rules | ❌ Deny access |
| Blacklisted or inactive member | ❌ Deny access |
| Entry outside permitted day or time | ❌ Deny access |
| Valid member within the policy and configured limits | ✅ Allow access |

These are **policy examples**, not a universal claim about every customer deployment or terminal. The final decision follows the implementation, membership status, configured rules and the selected edition.

## Key features

### 🔐 Membership-aware access control
- Validate active, pending or expired membership state in the access workflow.
- Apply payment/debt restrictions and member status checks.
- Enforce configurable allowed days, times and certain entry limits.
- Record allowed/denied events and the reason for refusal.
- Optionally activate eligible pending memberships during the documented entry workflow.

### 👆 Fingerprint terminal & device integration
- ZKTeco K40 integration and documented real-device tests.
- Map device users to application member records.
- Process entry/exit events, deduplicate logs and inspect device health.
- Integrate supported door-unlock or relay flows **when configured and authorized**.
- Keep attendance recording separate from physical door permissions where required.

### 📊 Management dashboard
- Active memberships and members approaching expiry.
- Debtors and outstanding membership/payment indicators.
- Today's entries, authorized and denied attempts.
- People currently inside, activity charts and peak entry periods.
- Revenue/payment summaries, subject to the user's permissions.
- Recent device activity and event details.

Dashboard values come from the application database; any promotional examples or illustrations should use **synthetic demo data**, never customer records.

### 👥 Members, staff & attendance
- Member and employee registration and profile management.
- Membership plans, renewals, payment tracking and member history.
- Staff shifts, clock-in/clock-out records and daily attendance reporting.
- Role-based administration, audit logs and access to management workflows.

### 🧾 Operations, reports & recovery
- Attendance and administrative reports with available export workflows.
- Financial, expenses and payroll-related modules in the FULL edition.
- Local-first PostgreSQL data storage, backup workflows and controlled restore procedures.
- Windows packaging, licensing and release verification work tracked in technical documentation.

## Editions and project status

| Edition | Focus |
| --- | --- |
| **FULL** | Membership-aware access decisions, gym/member management, finances, reporting and relevant door-control workflows |
| **ATTENDANCE** | Staff time-clock workflows and attendance records, with a strict boundary between recording a punch and granting door access |

**Project status: Active development.** Application modules and tests coexist with experimental licensing, installer and Windows-hardening work. Certain production release and security acceptance gates are **not yet complete**. A successful source build is **not** a guarantee of certified door security or a finished production Windows installer.

For exact scope, consult the [project checklist](docs/project/PROJECT_CHECKLIST.md), [attendance checklist](docs/project/ATTENDANCE_EDITION_CHECKLIST.md), and [Windows support matrix](docs/operations/WINDOWS_SUPPORT_MATRIX.md).

## Technology stack

| Layer | Main technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Database | PostgreSQL, Prisma 7 |
| Tests | Playwright, unit and integration test scripts |
| Device integration | ZKTeco K40 and related event-processing workflows |
| Licensing / Windows research | C# / .NET, native Windows experiments, test vectors |

## Repository layout

```text
client/       React application and frontend tests
server/       Express API, Prisma schema/migrations, backend tests
scripts/      Edition build, verification and test utilities
licensing/    Protocols, vectors and experimental adapters
docs/         Architecture, features, project status and operations
version.json  Canonical product/version/build identity
```

## Quick start — local development (Windows PowerShell)

**Prerequisites:** Node.js **24.19.0** (required by this repository's build contract), npm and a local PostgreSQL instance. Some Windows and licensing experiments additionally require a compatible .NET SDK and dedicated test environment.

**1. Clone and install dependencies**

```powershell
git clone https://github.com/ejnaseri/entry-control-system.git
cd entry-control-system
npm --prefix server ci
npm --prefix client ci
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

**2. Prepare a development database**

Create an **empty, isolated PostgreSQL development database and role**. Edit `server/.env` to replace the sample `DATABASE_URL` and its `CHANGE_ME` password with your own credentials. Configure devices only in a safe test environment; the sample device addresses are documentation placeholders.

**3. Start the API**

```powershell
cd server
npx prisma generate
npx prisma migrate deploy
npm run dev
```

**4. Start the frontend in another terminal**

```powershell
cd client
npm run dev
```

Vite reports the local frontend URL. The example backend address is `http://localhost:4000`. These are **development instructions, not a production installation procedure**. Inspect migrations before applying them, and never use a real customer database for development.

## Building and testing

Use Node.js **24.19.0**, install the project dependencies and run from the repository root:

```powershell
npm run build:full
npm run build:attendance
npm run verify:full
npm run verify:attendance
npm run test:docs-links
npm run test:license-protocol-v1
npm run test:license-golden-vectors
```

Edition artifacts are produced in `release/FULL` and `release/ATTENDANCE`. Documented Phase 6.1 outputs are **unsigned development builds**, not accepted signed production installers. Some licensing test consumers require the project's pinned .NET environment.

## Technical documentation

- [Project documentation index](docs/README.md)
- [Current development and quality checklist](docs/project/PROJECT_CHECKLIST.md)
- [Attendance edition and safety boundaries](docs/project/ATTENDANCE_EDITION_CHECKLIST.md)
- [Security design](docs/architecture/security-design.md)
- [ZKTeco K40 setup and physical test evidence](docs/operations/k40-setup.md)
- [Backup and restore policy](docs/operations/backup-restore.md)
- [Windows compatibility and support scope](docs/operations/WINDOWS_SUPPORT_MATRIX.md)
- [Licensing design, experiments and acceptance status](docs/licensing/README.md)

## Contributing

Contributions to documentation, tests, device compatibility and application reliability are welcome. Please review the project's edition boundaries before proposing changes. Use synthetic test fixtures only; **do not publish member photos, fingerprints, real names, credentials, customer databases or device secrets** in issues or pull requests.

## Security note

ECS handles identity, physical-access and attendance information. Do **not** expose a development deployment to the public internet or connect unreviewed builds to production door hardware. If you find a vulnerability, avoid posting sensitive exploitation details publicly; contact the maintainer to arrange a private report.

## License

This repository is released under the [MIT License](LICENSE). Third-party libraries retain their own licenses. Commercial deployments remain subject to appropriate privacy, hardware and customer-data safeguards.

**Maintainer:** [Eraj Naseri](https://github.com/ejnaseri)
