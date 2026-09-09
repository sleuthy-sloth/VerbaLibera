import { beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createHostedEnvironment } from '@/features/course-pack/hosted-environment';
import { encodeBackup } from '@/features/course-pack/storage';
import type { ActivityAttempt } from '@/features/course-pack/attempts';
const legacy = {id:'legacy',packId:'it-foundations',version:'1.0.0',exerciseId:'one',at:'2026-09-08T10:00:00.000Z',correct:true,revealed:false};
const attempt:ActivityAttempt={eventVersion:2,type:'attempt',id:'attempt',packId:'it-foundations',packVersion:'1.0.0',lessonId:'it-story',lessonRevision:1,stepId:'one',activityId:'one',activityRevision:1,evidenceKey:'one',response:{kind:'text',text:'ciao'},assistance:[],evaluation:{outcome:'correct',independent:true,feedback:'Good'},at:legacy.at};
beforeEach(()=>vi.stubGlobal('indexedDB',new IDBFactory()));
it('imports both event collections and exports them together', async()=>{
 const environment=createHostedEnvironment('a');
 await environment.backup!.import(JSON.stringify(encodeBackup([legacy],[attempt])));
 expect(await environment.practice.read('a')).toEqual([legacy]);
 expect(await environment.lessonPractice!.readLessons()).toEqual([attempt]);
 expect(await environment.backup!.export()).toEqual(encodeBackup([legacy],[attempt]));
});
it('rejects a lesson conflict without importing otherwise valid legacy rows', async()=>{
 const environment=createHostedEnvironment('a');
 await environment.lessonPractice!.writeLessons([attempt]);
 await expect(environment.backup!.import(JSON.stringify(encodeBackup([legacy],[{...attempt,response:{kind:'text',text:'conflict'}}])))).rejects.toThrow(/Conflicting/);
 expect(await environment.practice.read('a')).toEqual([]);
 expect(await environment.lessonPractice!.readLessons()).toEqual([attempt]);
});
it('keeps the import bound to its account',async()=>{
 const first=createHostedEnvironment('a'), second=createHostedEnvironment('b');
 await first.backup!.import(JSON.stringify(encodeBackup([legacy],[attempt])));
 expect(await second.backup!.export()).toEqual({format:1,events:[]});
});

it.each(['durable','temporary'] as const)('restores portable %s backups without a partial conflicting import', async mode => {
 const {createPortableEnvironment}=await import('@/features/course-pack/portable-environment');
 const environment=await createPortableEnvironment({packs:{},assets:{}},{indexedDB:mode==='durable'?new IDBFactory():undefined});
 await environment.backup!.import(JSON.stringify(encodeBackup([],[attempt])));
 await expect(environment.backup!.import(JSON.stringify(encodeBackup([legacy],[{...attempt,response:{kind:'text',text:'conflict'}}])))).rejects.toThrow(/Conflicting/);
 expect(await environment.practice.read()).toEqual([]);
 expect(await environment.lessonPractice!.readLessons()).toEqual([attempt]);
 await environment.backup!.import(JSON.stringify(encodeBackup([legacy],[attempt])));
 expect(await environment.backup!.export()).toEqual(encodeBackup([legacy],[attempt]));
});
