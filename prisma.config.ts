import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    // Prisma 7 keeps connection URLs out of schema.prisma. Validation and
    // client generation do not connect; migrations/seeding require DATABASE_URL.
    url: process.env.DATABASE_URL ?? 'postgresql://unconfigured@localhost:1/voxlibre',
  },
});
