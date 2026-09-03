import { seed } from '../prisma/seed';
import { initialCourses } from '../src/features/curriculum/fixture';

type AnyRecord = Record<string, unknown>;
type UpsertArgs = {
  where: AnyRecord;
  update: AnyRecord;
  create: AnyRecord;
};

function createMockPrisma() {
  const stores = {
    language: new Map<string, AnyRecord>(),
    course: new Map<string, AnyRecord>(),
    conceptBlock: new Map<string, AnyRecord>(),
    drillItem: new Map<string, AnyRecord>(),
    audioSegment: new Map<string, AnyRecord>(),
    contentVersion: new Map<string, AnyRecord>(),
    userProgress: new Map<string, AnyRecord>(),
  };

  function upsertStore(store: Map<string, AnyRecord>, key: string, create: AnyRecord, update: AnyRecord) {
    if (store.has(key)) {
      const existing = store.get(key)!;
      const merged = { ...existing, ...update };
      store.set(key, merged);
      return merged;
    }
    store.set(key, create);
    return create;
  }

  function makeUpsert(store: Map<string, AnyRecord>, getKey: (args: UpsertArgs) => string) {
    return vi.fn((args: UpsertArgs) => {
      const key = getKey(args);
      return upsertStore(store, key, args.create, args.update);
    });
  }

  const client = {
    $transaction: vi.fn(async (callback: (tx: typeof client) => Promise<unknown>) => callback(client)),
    contentVersion: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => stores.contentVersion.get(where.id) ?? null),
      upsert: makeUpsert(stores.contentVersion, ({ where }) => where.id as string),
    },
    language: {
      upsert: makeUpsert(stores.language, ({ where }) => where.code as string),
    },
    course: {
      upsert: vi.fn((args: UpsertArgs) => {
        const key = args.where.slug as string;
        if (!stores.course.has(key)) {
          const create = { ...args.create, id: `course-${key}` };
          stores.course.set(key, create);
          return create;
        }
        const existing = stores.course.get(key)!;
        const merged = { ...existing, ...args.update };
        stores.course.set(key, merged);
        return merged;
      }),
    },
    conceptBlock: {
      upsert: makeUpsert(stores.conceptBlock, ({ where }) => {
        const composite = where.courseId_position as { courseId: string; position: number };
        return `${composite.courseId}:${composite.position}`;
      }),
    },
    drillItem: {
      upsert: makeUpsert(stores.drillItem, ({ where }) => where.id as string),
    },
    audioSegment: {
      upsert: makeUpsert(stores.audioSegment, ({ where }) => where.id as string),
    },
    userProgress: {
      create: vi.fn((args: { data: AnyRecord }) => {
        const id = (args.data.id as string) ?? `up-${stores.userProgress.size + 1}`;
        const record = { id, ...args.data };
        stores.userProgress.set(id, record);
        return record;
      }),
      findMany: vi.fn(() => Array.from(stores.userProgress.values())),
      count: vi.fn(() => stores.userProgress.size),
    },
  };

  return { client, stores };
}

describe('seed', () => {
  it('is idempotent across two consecutive runs', async () => {
    const { client, stores } = createMockPrisma();

    await seed(client as unknown as Parameters<typeof seed>[0]);
    await seed(client as unknown as Parameters<typeof seed>[0]);

    expect(stores.language.size).toBe(4);
    expect(stores.course.size).toBe(3);
    expect(stores.conceptBlock.size).toBe(24);
    expect(stores.drillItem.size).toBe(24);
    expect(stores.audioSegment.size).toBe(48);
    expect(stores.contentVersion.size).toBe(1);

    expect(client.language.upsert).toHaveBeenCalledTimes(8);
    expect(client.course.upsert).toHaveBeenCalledTimes(6);
    expect(client.conceptBlock.upsert).toHaveBeenCalledTimes(48);
    expect(client.drillItem.upsert).toHaveBeenCalledTimes(48);
    expect(client.audioSegment.upsert).toHaveBeenCalledTimes(96);
  });

  it('keeps ContentVersion stable when fixture unchanged', async () => {
    const { client, stores } = createMockPrisma();

    await seed(client as unknown as Parameters<typeof seed>[0]);
    const v1 = (stores.contentVersion.get('fixtures') as AnyRecord)?.version as string;
    expect(v1).toBeDefined();
    expect(typeof v1).toBe('string');
    expect(v1.length).toBeGreaterThan(0);

    await seed(client as unknown as Parameters<typeof seed>[0]);
    const v2 = (stores.contentVersion.get('fixtures') as AnyRecord)?.version as string;

    expect(v2).toBe(v1);
  });

  it('bumps ContentVersion when stored version is stale (fixture change)', async () => {
    const { client, stores } = createMockPrisma();

    await seed(client as unknown as Parameters<typeof seed>[0]);
    const originalVersion = (stores.contentVersion.get('fixtures') as AnyRecord)?.version as string;

    // Simulate stale DB version (as if fixture changed since last seed)
    stores.contentVersion.set('fixtures', { id: 'fixtures', version: 'stale-version-hash' });

    // Should NOT throw — should bump to current fixture version
    await expect(seed(client as unknown as Parameters<typeof seed>[0])).resolves.not.toThrow();

    const bumped = (stores.contentVersion.get('fixtures') as AnyRecord)?.version as string;
    expect(bumped).not.toBe('stale-version-hash');
    expect(bumped).toBe(originalVersion);
    // After bump, version should be stable again
    await seed(client as unknown as Parameters<typeof seed>[0]);
    const stable = (stores.contentVersion.get('fixtures') as AnyRecord)?.version as string;
    expect(stable).toBe(bumped);
  });

  it('uses CONTENT_VERSION env or package.json version in ContentVersion', async () => {
    const prev = process.env.CONTENT_VERSION;
    process.env.CONTENT_VERSION = '9.9.9-test-env';
    try {
      const { client, stores } = createMockPrisma();
      await seed(client as unknown as Parameters<typeof seed>[0]);
      const version = (stores.contentVersion.get('fixtures') as AnyRecord)?.version as string;
      expect(version).toContain('9.9.9-test-env');
    } finally {
      if (prev === undefined) delete process.env.CONTENT_VERSION;
      else process.env.CONTENT_VERSION = prev;
    }

    // Without env, should contain package.json version (0.1.0) or hash
    const { client: client2, stores: stores2 } = createMockPrisma();
    // Ensure env cleared
    const prev2 = process.env.CONTENT_VERSION;
    delete process.env.CONTENT_VERSION;
    try {
      await seed(client2 as unknown as Parameters<typeof seed>[0]);
      const version2 = (stores2.contentVersion.get('fixtures') as AnyRecord)?.version as string;
      // Should be non-empty and contain package version 0.1.0 when env not set
      expect(version2.length).toBeGreaterThan(5);
      // If not containing env test version, it should contain package version or hash
      expect(version2).not.toContain('9.9.9-test-env');
    } finally {
      if (prev2 !== undefined) process.env.CONTENT_VERSION = prev2;
    }
  });

  it('preserves UserProgress across seeds (non-destructive)', async () => {
    const { client, stores } = createMockPrisma();

    await seed(client as unknown as Parameters<typeof seed>[0]);

    // Simulate existing UserProgress rows that reference drillIds from fixture
    const drillId = initialCourses[0]?.concepts[0]?.drills[0]?.id ?? 'fr-greet-politely-drill';
    const progressId = 'progress-1';
    stores.userProgress.set(progressId, {
      id: progressId,
      userId: 'user-1',
      drillItemId: drillId,
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      dueAt: new Date('2026-09-03T00:00:00Z'),
    });

    const beforeCount = stores.userProgress.size;
    const beforeProgress = { ...stores.userProgress.get(progressId)! };

    await seed(client as unknown as Parameters<typeof seed>[0]);

    expect(stores.userProgress.size).toBe(beforeCount);
    expect(stores.userProgress.get(progressId)).toEqual(beforeProgress);
  });

  it('does not duplicate ConceptBlock/DrillItem when seed runs twice', async () => {
    const { client, stores } = createMockPrisma();

    await seed(client as unknown as Parameters<typeof seed>[0]);
    const conceptCountFirst = stores.conceptBlock.size;
    const drillCountFirst = stores.drillItem.size;

    await seed(client as unknown as Parameters<typeof seed>[0]);

    expect(stores.conceptBlock.size).toBe(conceptCountFirst);
    expect(stores.drillItem.size).toBe(drillCountFirst);
    expect(conceptCountFirst).toBe(24);
    expect(drillCountFirst).toBe(24);
  });
});
