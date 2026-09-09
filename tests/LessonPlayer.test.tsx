import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, it, expect } from 'vitest';
import { LessonPlayer } from '@/features/course-pack/LessonPlayer';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import { createMemoryLessonPractice, type CourseEnvironment } from '@/features/course-pack/environment';
import { makePilotPack } from './fixtures/lesson-variety';
const pack = normalizePack(makePilotPack());
const env = (): CourseEnvironment => ({ capabilities: {accounts:false,synchronization:false,offlineInstall:false,hostedNavigation:false}, practice:{getDurability:()=> 'durable',subscribeDurability:()=>()=>{},read:async()=>[],write:async()=>{}},lessonPractice:createMemoryLessonPractice(),loadPack:vi.fn(),resolveMedia:(url)=>url });
it('checkpoints revealed assistance and refuses exit when checkpoint fails', async () => {
 const environment=env(), exit=vi.fn();
 render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={environment} onExit={exit}/>);
 await userEvent.click(await screen.findByRole('button',{name:'Show translation'}));
 await waitFor(async()=>expect((await environment.lessonPractice!.readCheckpoint(pack.id,'it-cafe-story'))?.assistance).toContain('translation'));
 vi.spyOn(environment.lessonPractice!,'writeCheckpoint').mockRejectedValue(new Error('offline'));
 await userEvent.click(screen.getByRole('button',{name:'← All lessons'}));
 expect(exit).not.toHaveBeenCalled();
 expect(await screen.findByRole('alert')).toHaveTextContent(/could not be saved/i);
});
it('hides previous account lesson while replacement store loads',async()=>{
 const first=env(), second=env();
 const view=render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={first} onExit={()=>{}}/>);
 await screen.findByRole('button',{name:'Show translation'});
 vi.spyOn(second.lessonPractice!,'readLessons').mockImplementation(()=>new Promise(()=>{}));
 view.rerender(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={second} onExit={()=>{}}/>);
 expect(screen.queryByRole('button',{name:'Show translation'})).toBeNull();
});
it('blocks listening grading after an audio failure',async()=>{
 render(<LessonPlayer pack={pack} lessonId="it-cafe-listening" environment={env()} onExit={()=>{}}/>);
 fireEvent.error(await screen.findByLabelText('Lesson audio'));
 expect(await screen.findByRole('alert')).toHaveTextContent(/audio/i);
 expect(screen.getByRole('button',{name:/Check|Continue/})).toBeDisabled();
});
it('keeps a revealed story assisted on the next question and after reopening',async()=>{
 const environment=env();
 const view=render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={environment} onExit={()=>{}}/>);
 await userEvent.click(await screen.findByRole('button',{name:'Show translation'}));
 await userEvent.click(screen.getByRole('button',{name:'Continue'}));
 await userEvent.click(await screen.findByRole('button',{name:'Next step'}));
 await userEvent.click(await screen.findByRole('radio',{name:'Un caffè'}));
 await userEvent.click(screen.getByRole('button',{name:'Check'}));
 await screen.findByText(/Saved as assisted practice/);
 const events=await environment.lessonPractice!.readLessons();
 const attempts=events.filter(e=>'eventVersion' in e && e.type==='attempt');
 expect(attempts.at(-1)).toMatchObject({assistance:['translation'],evaluation:{independent:false}});
 await waitFor(async()=>expect((await environment.lessonPractice!.readCheckpoint(pack.id,'it-cafe-story'))?.stepId).toBe('st-s2'));
 view.unmount();
 render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={environment} onExit={()=>{}}/>);
 await screen.findByText(/Saved as assisted practice/);
});
it('retries an event write with the same logical IDs',async()=>{
 const environment=env();
 const write=vi.spyOn(environment.lessonPractice!,'writeLessons');
 write.mockRejectedValueOnce(new Error('offline'));
 render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={environment} onExit={()=>{}}/>);
 await userEvent.click(await screen.findByRole('button',{name:'Continue'}));
 await userEvent.click(await screen.findByRole('button',{name:'Retry save'}));
 await screen.findByRole('button',{name:'Next step'});
 expect(write.mock.calls[1][0]).toEqual(write.mock.calls[0][0]);
});
it('recovers committed steps when the checkpoint is missing',async()=>{
 const environment=env();
 const view=render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={environment} onExit={()=>{}}/>);
 await userEvent.click(await screen.findByRole('button',{name:'Continue'}));
 await screen.findByRole('button',{name:'Next step'});
 view.unmount();
 vi.spyOn(environment.lessonPractice!,'readCheckpoint').mockResolvedValue(null);
 render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={environment} onExit={()=>{}}/>);
 expect(await screen.findByRole('radio',{name:'Un caffè'})).toBeVisible();
});
it('does not start a writable session when stored progress cannot be read',async()=>{
 const environment=env();
 vi.spyOn(environment.lessonPractice!,'readLessons').mockRejectedValue(new Error('unavailable'));
 const writes=vi.spyOn(environment.lessonPractice!,'writeCheckpoint');
 render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={environment} onExit={()=>{}}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/);
 expect(screen.queryByRole('button',{name:'Continue'})).toBeNull();
 expect(writes).not.toHaveBeenCalled();
});
