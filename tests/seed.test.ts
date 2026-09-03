import { seed } from '../prisma/seed';

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
  };

  return { client, stores };
}

describe('seed', () => {
  it('is idempotent across two consecutive runs', async () => {
    const { client, stores } = createMockPrisma();

    await seed(client as unknown as Parameters<typeof seed>[0]);
    await seed(client as unknown as Parameters<typeof seed>[0]);

    expect(stores.language.size).toBe(3);
    expect(stores.course.size).toBe(2);
    expect(stores.conceptBlock.size).toBe(10);
    expect(stores.drillItem.size).toBe(10);
    expect(stores.audioSegment.size).toBe(20);
    expect(stores.contentVersion.size).toBe(1);

    expect(client.language.upsert).toHaveBeenCalledTimes(6);
    expect(client.course.upsert).toHaveBeenCalledTimes(4);
    expect(client.conceptBlock.upsert).toHaveBeenCalledTimes(20);
    expect(client.drillItem.upsert).toHaveBeenCalledTimes(20);
    expect(client.audioSegment.upsert).toHaveBeenCalledTimes(40);
  });

  it('detects fixture drift between consecutive runs', async () => {
    const { client, stores } = createMockPrisma();

    await seed(client as unknown as Parameters<typeof seed>[0]);

    stores.contentVersion.set('fixtures', { id: 'fixtures', version: 'stale-version-hash' });

    await expect(seed(client as unknown as Parameters<typeof seed>[0])).rejects.toThrow(
      'Fixture drift detected',
    );
  });
});
