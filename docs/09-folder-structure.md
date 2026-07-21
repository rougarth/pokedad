# Folder Structure

```text
poke-dad-radar/
  apps/
    api/
      prisma/
      src/
        config/
        modules/
        plugins/
        security/
        workers/
    web/
      src/
        components/
        pages/
        router/
        stores/
    extension/
      public/
      src/
  packages/
    shared/
      src/
  docs/
  docker-compose.yml
  package.json
  tsconfig.base.json
```

## Package Roles

- `apps/api`: backend API, Prisma, queues, workers, alert delivery, auditing.
- `apps/web`: private dashboard.
- `apps/extension`: browser helper.
- `packages/shared`: shared enums, DTOs, and rule helpers.
- `docs`: product and architecture documents.

## Naming

- Use `PokeDad Radar` in user-facing text.
- Use `poke-dad-radar` for package and folder names.
- Use cents integers for money in APIs and database fields.

