/**
 * Service templates: an opinionated starting point for one service, per
 * language/framework. Applying a template (edits.ts `applyServiceTemplate`)
 * fills the service's language/framework/runtime, adds service-scoped tech
 * stack items and conventions, and builds the layer structure with the allowed
 * dependency directions. Everything it creates is ordinary design data the user
 * can edit afterwards. Versions are the recommended baseline as of 2026-10;
 * review them per project.
 *
 * Pure data, isomorphic.
 */
import type { Convention, EnvVar, StackItem } from "@/lib/design/schema";

type Rule = Pick<Convention, "category" | "level" | "rule">;
type Tool = Pick<StackItem, "category" | "name" | "version" | "notes">;

export interface TemplateLayer {
  /** Local key used by `dependsOn`. */
  key: string;
  name: string;
  /** Directory relative to the service root. */
  path: string;
  responsibilities: string[];
  rules: string[];
  /** Keys of layers this layer may depend on. */
  dependsOn: string[];
}

export interface ServiceTemplate {
  id: string;
  label: string;
  /** One sentence for pickers and agents. */
  summary: string;
  type: "api" | "web-app" | "worker" | "cli" | "library";
  language: string;
  framework: string;
  runtime: string;
  /** Used only when the service has no path yet. */
  defaultPath: string;
  port: number | null;
  env: Pick<EnvVar, "name" | "description" | "required" | "secret" | "example">[];
  stack: Tool[];
  conventions: Rule[];
  patterns: { name: string; notes: string }[];
  /** Top to bottom on the canvas; the first layer is the outermost. */
  layers: TemplateLayer[];
}

const env = (
  name: string,
  description: string,
  example = "",
  secret = false,
): ServiceTemplate["env"][number] => ({ name, description, required: true, secret, example });

const must = (category: Rule["category"], rule: string): Rule => ({
  category,
  level: "must",
  rule,
});
const should = (category: Rule["category"], rule: string): Rule => ({
  category,
  level: "should",
  rule,
});

/** Layer set shared by the clean/hexagonal-style templates: outer → inner. */
function layers(spec: {
  entry: Pick<TemplateLayer, "name" | "path" | "responsibilities" | "rules">;
  application: Pick<TemplateLayer, "name" | "path" | "responsibilities" | "rules">;
  domain: Pick<TemplateLayer, "name" | "path" | "responsibilities" | "rules">;
  infrastructure: Pick<TemplateLayer, "name" | "path" | "responsibilities" | "rules">;
}): TemplateLayer[] {
  return [
    { key: "entry", ...spec.entry, dependsOn: ["application"] },
    { key: "application", ...spec.application, dependsOn: ["domain"] },
    { key: "domain", ...spec.domain, dependsOn: [] },
    { key: "infrastructure", ...spec.infrastructure, dependsOn: ["application", "domain"] },
  ];
}

const DOTNET: ServiceTemplate = {
  id: "dotnet-aspnet",
  label: ".NET — ASP.NET Core Web API",
  summary: "C# on .NET 10 LTS with ASP.NET Core minimal APIs, Clean Architecture and EF Core.",
  type: "api",
  language: "C#",
  framework: "ASP.NET Core",
  runtime: ".NET 10",
  defaultPath: "src/Api",
  port: 8080,
  env: [
    env("ASPNETCORE_URLS", "Address the server binds to", "http://+:8080"),
    env(
      "CONNECTIONSTRINGS__DEFAULT",
      "Database connection string (.NET configuration keys are case-insensitive)",
      "Host=db;Database=app",
      true,
    ),
  ],
  stack: [
    { category: "language", name: "C#", version: "14", notes: "Nullable reference types on." },
    { category: "framework", name: "ASP.NET Core", version: "10", notes: "Minimal APIs." },
    {
      category: "orm",
      name: "Entity Framework Core",
      version: "10",
      notes: "Code-first migrations.",
    },
    {
      category: "testing",
      name: "xUnit",
      version: "3",
      notes: "Plus WebApplicationFactory and Testcontainers for integration tests.",
    },
    {
      category: "build",
      name: "dotnet CLI / MSBuild",
      version: "",
      notes: "One solution; Directory.Build.props and central package management.",
    },
    {
      category: "observability",
      name: "Serilog + OpenTelemetry",
      version: "",
      notes: "Structured logs, traces and metrics.",
    },
  ],
  conventions: [
    must(
      "structure",
      "One project per layer (Api, Application, Domain, Infrastructure) in a single solution; project references must follow the layer dependencies.",
    ),
    must(
      "code-style",
      "Enable <Nullable>enable</Nullable> and <TreatWarningsAsErrors>true</TreatWarningsAsErrors> in Directory.Build.props.",
    ),
    must(
      "error-handling",
      "Return RFC 9457 ProblemDetails for every error response; never leak exception details.",
    ),
    should(
      "naming",
      "PascalCase for types and members, async methods end in Async, interfaces start with I.",
    ),
    should(
      "code-style",
      "Pass CancellationToken through every async call; use records for DTOs and value objects.",
    ),
    should(
      "testing",
      "Unit-test Domain and Application without I/O; cover endpoints with WebApplicationFactory.",
    ),
  ],
  patterns: [
    {
      name: "Dependency Injection",
      notes: "Built-in container; register per layer in an AddXxx extension method.",
    },
    {
      name: "Repository",
      notes: "Interfaces in Application, EF Core implementations in Infrastructure.",
    },
    { name: "Mediator", notes: "Optional: one handler per use case." },
  ],
  layers: layers({
    entry: {
      name: "Api",
      path: "src/Api",
      responsibilities: [
        "Minimal API endpoints, request/response DTOs, auth, composition root (Program.cs)",
      ],
      rules: ["No business logic; map requests to Application use cases"],
    },
    application: {
      name: "Application",
      path: "src/Application",
      responsibilities: ["Use cases, validation, ports (repository and gateway interfaces)"],
      rules: ["No reference to Infrastructure or ASP.NET Core"],
    },
    domain: {
      name: "Domain",
      path: "src/Domain",
      responsibilities: ["Entities, value objects, domain events and rules"],
      rules: ["No project or package references other than the BCL"],
    },
    infrastructure: {
      name: "Infrastructure",
      path: "src/Infrastructure",
      responsibilities: [
        "EF Core DbContext and migrations, port implementations, external clients",
      ],
      rules: ["Implements Application ports; never referenced by Application or Domain"],
    },
  }),
};

const NODE: ServiceTemplate = {
  id: "node-fastify",
  label: "Node.js — TypeScript + Fastify API",
  summary: "TypeScript on Node.js 24 LTS with Fastify, Zod validation and a layered structure.",
  type: "api",
  language: "TypeScript",
  framework: "Fastify",
  runtime: "Node.js 24 LTS",
  defaultPath: "services/api",
  port: 3000,
  env: [
    env("PORT", "HTTP port", "3000"),
    env("DATABASE_URL", "Database connection string", "postgres://user:pass@db:5432/app", true),
    env("LOG_LEVEL", "pino log level", "info"),
  ],
  stack: [
    {
      category: "language",
      name: "TypeScript",
      version: "6",
      notes: "strict mode, ESM, noUncheckedIndexedAccess.",
    },
    {
      category: "framework",
      name: "Fastify",
      version: "5",
      notes: "Plugins for wiring; schema-based validation.",
    },
    {
      category: "library",
      name: "Zod",
      version: "4",
      notes: "Validate every external input and derive types.",
    },
    {
      category: "testing",
      name: "Vitest",
      version: "",
      notes: "Unit tests next to code; integration tests use fastify.inject.",
    },
    {
      category: "build",
      name: "tsx / tsc",
      version: "",
      notes: "tsx for dev, tsc for the production build.",
    },
    {
      category: "observability",
      name: "pino",
      version: "",
      notes: "Structured JSON logs (Fastify default).",
    },
    { category: "other", name: "ESLint + Prettier", version: "", notes: "Lint and format in CI." },
  ],
  conventions: [
    must("code-style", "TypeScript strict mode; no `any` — use `unknown` and narrow it."),
    must(
      "security",
      "Validate all request input with Zod schemas at the HTTP boundary; never trust req.body.",
    ),
    must(
      "error-handling",
      "Throw typed AppError subclasses in services; one Fastify error handler maps them to responses.",
    ),
    should(
      "structure",
      "ES modules and a package.json `exports` map; no circular imports between layers.",
    ),
    should("naming", "kebab-case file names, PascalCase types, camelCase functions."),
    should(
      "testing",
      "Test services with in-memory fakes of repositories; reserve a real database for repository tests.",
    ),
  ],
  patterns: [
    {
      name: "Dependency Injection",
      notes: "Constructor/factory injection; compose in one buildApp() function.",
    },
    { name: "Repository", notes: "Interfaces in application, implementations in infrastructure." },
    { name: "Service Layer", notes: "Use-case functions or classes called by route handlers." },
  ],
  layers: layers({
    entry: {
      name: "HTTP",
      path: "src/http",
      responsibilities: ["Fastify routes, Zod schemas, plugins, error handler"],
      rules: ["No business logic or database access"],
    },
    application: {
      name: "Application",
      path: "src/application",
      responsibilities: ["Use cases and repository/gateway interfaces"],
      rules: ["No Fastify or database-driver imports"],
    },
    domain: {
      name: "Domain",
      path: "src/domain",
      responsibilities: ["Types, invariants and pure business rules"],
      rules: ["Pure TypeScript; no I/O, no framework imports"],
    },
    infrastructure: {
      name: "Infrastructure",
      path: "src/infrastructure",
      responsibilities: ["Database access, queue and HTTP clients, config loading"],
      rules: ["Implements application interfaces; never imported by domain or application"],
    },
  }),
};

const GO: ServiceTemplate = {
  id: "go-service",
  label: "Go — net/http service",
  summary:
    "Go 1.27 with the standard library router, the standard project layout and consumer-side interfaces.",
  type: "api",
  language: "Go",
  framework: "net/http (stdlib)",
  runtime: "Go 1.27",
  defaultPath: "services/api",
  port: 8080,
  env: [
    env("PORT", "HTTP port", "8080"),
    env("DATABASE_URL", "Database connection string", "postgres://user:pass@db:5432/app", true),
    env("LOG_LEVEL", "slog level: debug, info, warn, error", "info"),
  ],
  stack: [
    {
      category: "language",
      name: "Go",
      version: "1.27",
      notes: "Go modules; go.mod pins the toolchain.",
    },
    {
      category: "framework",
      name: "net/http",
      version: "",
      notes:
        "Stdlib ServeMux with method and path patterns; add chi only if middleware needs grow.",
    },
    {
      category: "database",
      name: "pgx",
      version: "5",
      notes: "Pool-based driver; sqlc for typed queries.",
    },
    {
      category: "testing",
      name: "testing + testify",
      version: "",
      notes: "Table-driven tests; httptest for handlers; run with -race.",
    },
    {
      category: "observability",
      name: "log/slog",
      version: "",
      notes: "Structured logging from the stdlib.",
    },
    {
      category: "other",
      name: "golangci-lint",
      version: "",
      notes: "Includes gofmt/goimports, vet and staticcheck.",
    },
  ],
  conventions: [
    must(
      "structure",
      "main packages live in cmd/<name>; all other code is under internal/ so it cannot be imported by other modules.",
    ),
    must(
      "error-handling",
      'Return errors, don\'t panic; wrap with fmt.Errorf("...: %w", err) and compare with errors.Is/As.',
    ),
    must(
      "code-style",
      "Pass context.Context as the first parameter of every function that does I/O; never store it in a struct.",
    ),
    must("code-style", "gofmt and golangci-lint must pass; run tests with -race in CI."),
    should(
      "structure",
      "Define interfaces in the package that uses them (consumer side); keep them small.",
    ),
    should(
      "naming",
      "Short lowercase package names without underscores; no stutter (user.User → user.Account).",
    ),
    should("testing", "Table-driven tests with subtests; fakes over mocks."),
  ],
  patterns: [
    {
      name: "Dependency Injection",
      notes: "Explicit constructors; wire everything in cmd/<name>/main.go.",
    },
    {
      name: "Repository",
      notes: "Interface declared by the service package, implemented in store.",
    },
    {
      name: "Chain of Responsibility",
      notes: "HTTP middleware as func(http.Handler) http.Handler.",
    },
  ],
  layers: layers({
    entry: {
      name: "Transport",
      path: "internal/transport",
      responsibilities: ["HTTP handlers, request decoding, response encoding, middleware"],
      rules: ["No business logic; call the service layer only"],
    },
    application: {
      name: "Service",
      path: "internal/service",
      responsibilities: ["Use cases; declares the store interfaces it needs"],
      rules: ["Does not import net/http or the store package"],
    },
    domain: {
      name: "Domain",
      path: "internal/domain",
      responsibilities: ["Types and business rules"],
      rules: ["Standard library only"],
    },
    infrastructure: {
      name: "Store",
      path: "internal/store",
      responsibilities: ["Database access (pgx/sqlc), external clients"],
      rules: ["Satisfies service-layer interfaces implicitly; imported only from main"],
    },
  }),
};

const RUST: ServiceTemplate = {
  id: "rust-axum",
  label: "Rust — Axum service",
  summary:
    "Rust 2024 edition on stable with Axum, Tokio and SQLx, split into API/application/domain/infrastructure modules.",
  type: "api",
  language: "Rust",
  framework: "Axum",
  runtime: "Rust stable (edition 2024) + Tokio",
  defaultPath: "services/api",
  port: 8080,
  env: [
    env("PORT", "HTTP port", "8080"),
    env("DATABASE_URL", "Database connection string", "postgres://user:pass@db:5432/app", true),
    env("RUST_LOG", "tracing-subscriber filter", "info"),
  ],
  stack: [
    {
      category: "language",
      name: "Rust",
      version: "stable, edition 2024",
      notes: "Pin with rust-toolchain.toml.",
    },
    {
      category: "framework",
      name: "Axum",
      version: "",
      notes: "Tower middleware; share state via State<Arc<AppState>>.",
    },
    { category: "library", name: "Tokio", version: "1", notes: "Async runtime." },
    {
      category: "database",
      name: "SQLx",
      version: "",
      notes: "Compile-time checked queries; migrations with sqlx migrate.",
    },
    {
      category: "library",
      name: "thiserror + anyhow",
      version: "",
      notes: "thiserror for library/domain errors, anyhow only in main.",
    },
    {
      category: "testing",
      name: "cargo test / nextest",
      version: "",
      notes: "Unit tests in-module; integration tests in tests/.",
    },
    {
      category: "observability",
      name: "tracing",
      version: "",
      notes: "Spans and structured logs.",
    },
    {
      category: "other",
      name: "rustfmt + clippy",
      version: "",
      notes: "cargo fmt --check and cargo clippy -- -D warnings in CI.",
    },
  ],
  conventions: [
    must("code-style", "cargo fmt and cargo clippy -D warnings must pass."),
    must(
      "error-handling",
      "No unwrap()/expect() outside tests and startup; return Result and convert to HTTP errors in one IntoResponse impl.",
    ),
    must("code-style", "No `unsafe` unless justified in a comment and reviewed."),
    should(
      "structure",
      "Model domain states with enums and newtypes so invalid states are unrepresentable.",
    ),
    should("structure", "Keep modules small; expose a minimal pub API (pub(crate) by default)."),
    should(
      "naming",
      "snake_case functions and modules, CamelCase types, SCREAMING_SNAKE_CASE constants.",
    ),
    should(
      "testing",
      "Run integration tests against a real database (testcontainers or docker compose).",
    ),
  ],
  patterns: [
    {
      name: "Ports and Adapters",
      notes: "Traits in the application module, implemented in infrastructure.",
    },
    {
      name: "Dependency Injection",
      notes: "Generics or Arc<dyn Trait> in AppState, wired in main.rs.",
    },
    { name: "Builder", notes: "For config and complex request types." },
  ],
  layers: layers({
    entry: {
      name: "API",
      path: "src/api",
      responsibilities: ["Axum router, extractors, handlers, error-to-response mapping"],
      rules: ["No SQL or business logic"],
    },
    application: {
      name: "Application",
      path: "src/application",
      responsibilities: ["Use cases and the traits (ports) they need"],
      rules: ["Does not depend on axum or sqlx"],
    },
    domain: {
      name: "Domain",
      path: "src/domain",
      responsibilities: ["Entities, value objects and invariants"],
      rules: ["No async, no I/O, no framework crates"],
    },
    infrastructure: {
      name: "Infrastructure",
      path: "src/infrastructure",
      responsibilities: ["SQLx repositories, external clients, config"],
      rules: ["Implements application traits; only main.rs wires it in"],
    },
  }),
};

const JAVA: ServiceTemplate = {
  id: "java-spring-boot",
  label: "Java — Spring Boot service",
  summary:
    "Java 25 LTS with Spring Boot, Maven, Flyway and Testcontainers in a hexagonal package layout.",
  type: "api",
  language: "Java",
  framework: "Spring Boot",
  runtime: "Java 25 LTS (JVM)",
  defaultPath: "services/api",
  port: 8080,
  env: [
    env("SERVER_PORT", "HTTP port", "8080"),
    env("SPRING_DATASOURCE_URL", "JDBC URL", "jdbc:postgresql://db:5432/app"),
    env("SPRING_DATASOURCE_PASSWORD", "Database password", "", true),
  ],
  stack: [
    {
      category: "language",
      name: "Java",
      version: "25",
      notes: "Records, sealed types and pattern matching preferred.",
    },
    {
      category: "framework",
      name: "Spring Boot",
      version: "4",
      notes: "Current GA line; spring-boot-starter-web and actuator.",
    },
    { category: "build", name: "Maven", version: "3.9", notes: "Use the Maven wrapper (./mvnw)." },
    {
      category: "orm",
      name: "Spring Data JPA / Hibernate",
      version: "",
      notes: "Or JdbcClient for query-heavy code.",
    },
    {
      category: "database",
      name: "Flyway",
      version: "",
      notes: "SQL migrations in src/main/resources/db/migration.",
    },
    {
      category: "testing",
      name: "JUnit 5 + Testcontainers",
      version: "",
      notes: "@SpringBootTest slices; real database in integration tests.",
    },
    {
      category: "observability",
      name: "Micrometer + Actuator",
      version: "",
      notes: "Health, metrics and tracing.",
    },
    {
      category: "other",
      name: "Spotless",
      version: "",
      notes: "Enforce google-java-format in the build.",
    },
  ],
  conventions: [
    must(
      "structure",
      "Package by layer under one base package: web, application, domain, infrastructure; web may not access repositories directly.",
    ),
    must("code-style", "Constructor injection only; no field @Autowired."),
    must(
      "security",
      "Validate request bodies with Jakarta Bean Validation (@Valid) and never expose JPA entities in the API.",
    ),
    must(
      "error-handling",
      "Handle errors in one @RestControllerAdvice returning RFC 9457 ProblemDetail.",
    ),
    should("code-style", "Use records for DTOs and value objects; prefer immutability."),
    should("naming", "PascalCase classes, camelCase members, lower-case package names."),
    should(
      "testing",
      "Unit-test domain and application with plain JUnit; use Testcontainers for repositories.",
    ),
  ],
  patterns: [
    { name: "Dependency Injection", notes: "Spring container with constructor injection." },
    {
      name: "Repository",
      notes: "Spring Data repositories behind application-defined ports where logic matters.",
    },
    {
      name: "Service Layer",
      notes: "@Service use cases with @Transactional at the use-case boundary.",
    },
  ],
  layers: layers({
    entry: {
      name: "Web",
      path: "src/main/java/<base-package>/web",
      responsibilities: ["@RestController classes, request/response DTOs, exception advice"],
      rules: ["No business logic; call application services only"],
    },
    application: {
      name: "Application",
      path: "src/main/java/<base-package>/application",
      responsibilities: ["Use-case services, transactions, ports"],
      rules: ["No Spring MVC types; JPA entities do not cross this boundary"],
    },
    domain: {
      name: "Domain",
      path: "src/main/java/<base-package>/domain",
      responsibilities: ["Entities, value objects, domain services and events"],
      rules: ["Plain Java; no Spring annotations"],
    },
    infrastructure: {
      name: "Infrastructure",
      path: "src/main/java/<base-package>/infrastructure",
      responsibilities: ["Persistence adapters, external clients, configuration"],
      rules: ["Implements application ports; not referenced by web, application or domain"],
    },
  }),
};

const PYTHON: ServiceTemplate = {
  id: "python-fastapi",
  label: "Python — FastAPI service",
  summary: "Python 3.14 with FastAPI, Pydantic, SQLAlchemy 2 and uv, in a layered structure.",
  type: "api",
  language: "Python",
  framework: "FastAPI",
  runtime: "CPython 3.14",
  defaultPath: "services/api",
  port: 8000,
  env: [
    env("PORT", "HTTP port", "8000"),
    env(
      "DATABASE_URL",
      "Database connection string",
      "postgresql+psycopg://user:pass@db/app",
      true,
    ),
    env("LOG_LEVEL", "Python logging level", "INFO"),
  ],
  stack: [
    { category: "language", name: "Python", version: "3.14", notes: "Fully type-annotated." },
    {
      category: "framework",
      name: "FastAPI",
      version: "",
      notes: "Served by uvicorn; dependencies via Depends().",
    },
    {
      category: "library",
      name: "Pydantic",
      version: "2",
      notes: "Request/response models and settings.",
    },
    {
      category: "orm",
      name: "SQLAlchemy",
      version: "2",
      notes: "Async engine; Alembic for migrations.",
    },
    {
      category: "build",
      name: "uv",
      version: "",
      notes: "pyproject.toml and a committed uv.lock.",
    },
    {
      category: "testing",
      name: "pytest",
      version: "",
      notes: "pytest-asyncio and httpx.AsyncClient for endpoint tests.",
    },
    {
      category: "other",
      name: "ruff + mypy",
      version: "",
      notes: "Lint, format and type-check in CI.",
    },
  ],
  conventions: [
    must("code-style", "Type-annotate all public functions; mypy --strict must pass."),
    must("code-style", "ruff check and ruff format must pass."),
    must(
      "security",
      "Never build SQL from strings; use SQLAlchemy expressions or bound parameters.",
    ),
    should(
      "structure",
      "Keep route handlers thin; put logic in service functions that take their dependencies as arguments.",
    ),
    should("naming", "snake_case functions and modules, PascalCase classes."),
    should("testing", "Override FastAPI dependencies in tests instead of monkeypatching."),
  ],
  patterns: [
    {
      name: "Dependency Injection",
      notes: "FastAPI Depends() for sessions, settings and services.",
    },
    {
      name: "Repository",
      notes: "Protocol in application, SQLAlchemy implementation in infrastructure.",
    },
    { name: "Service Layer", notes: "Use-case functions called from routers." },
  ],
  layers: layers({
    entry: {
      name: "API",
      path: "app/api",
      responsibilities: ["Routers, request/response schemas, dependency providers"],
      rules: ["No business logic or SQL"],
    },
    application: {
      name: "Application",
      path: "app/application",
      responsibilities: ["Use cases and repository protocols"],
      rules: ["No FastAPI or SQLAlchemy imports"],
    },
    domain: {
      name: "Domain",
      path: "app/domain",
      responsibilities: ["Domain models and rules"],
      rules: ["Standard library (and dataclasses/Pydantic types) only; no I/O"],
    },
    infrastructure: {
      name: "Infrastructure",
      path: "app/infrastructure",
      responsibilities: ["SQLAlchemy models and repositories, external clients"],
      rules: ["Implements application protocols; never imported by domain or application"],
    },
  }),
};

export const SERVICE_TEMPLATES: readonly ServiceTemplate[] = [DOTNET, NODE, GO, RUST, JAVA, PYTHON];

export function getServiceTemplate(id: string): ServiceTemplate | undefined {
  return SERVICE_TEMPLATES.find((t) => t.id === id);
}
