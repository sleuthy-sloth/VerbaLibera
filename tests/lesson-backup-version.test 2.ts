import { expect, it } from 'vitest';
import { decodeBackup, decodeBackupEnvelope } from '@/features/course-pack/storage';
const legacy = {id:'backup-event', packId:'it-foundations', version:'1.0.0', exerciseId:'one', at:'2026-09-08T10:00:00.000Z', correct:true, revealed:false};
it.each([decodeBackup, decodeBackupEnvelope])('rejects a versioned event hidden in the legacy backup array', (decode) => {
  expect(() => decode(JSON.stringify({format:1, events:[{...legacy,eventVersion:3}]}))).toThrow();
});
it('rejects unknown versions in either format-two event array', () => {
  expect(() => decodeBackupEnvelope(JSON.stringify({format:2, events:[{...legacy,eventVersion:3}], lessonEvents:[]}))).toThrow();
  expect(() => decodeBackupEnvelope(JSON.stringify({format:2, events:[], lessonEvents:[{...legacy,eventVersion:3}]}))).toThrow();
});
