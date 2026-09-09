import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CourseWorkspace } from '@/features/course-pack/CourseWorkspace';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import { createMemoryLessonPractice, type CourseEnvironment } from '@/features/course-pack/environment';
import { makePilotPack } from './fixtures/lesson-variety';
it('opens a v2 story through the course boundary while keeping prerequisites locked',async()=>{
 const environment:CourseEnvironment={capabilities:{accounts:false,synchronization:false,offlineInstall:false,hostedNavigation:false},practice:{getDurability:()=> 'temporary',subscribeDurability:()=>()=>{},read:async()=>[],write:async()=>{}},lessonPractice:createMemoryLessonPractice(),loadPack:vi.fn(),loadCourse:async()=>normalizePack(makePilotPack()),resolveMedia:u=>u};
 render(<CourseWorkspace environment={environment}/>);
 await waitFor(() => expect(screen.getByRole('button',{name:'Una storia al bar'})).toBeEnabled());
 expect(screen.getByRole('navigation',{name:'Course path'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Al bar con il barista'})).toBeDisabled();
 await userEvent.click(screen.getByRole('button',{name:'Una storia al bar'}));
 await userEvent.click(screen.getByRole('button',{name:'Begin practice'}));
 expect(await screen.findByRole('button',{name:'Show translation'})).toBeVisible();
 expect(environment.loadPack).not.toHaveBeenCalled();
});
