// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi, it, expect } from 'vitest';
import { LessonPlayer } from '@/features/course-pack/LessonPlayer';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import { createMemoryLessonPractice, type CourseEnvironment } from '@/features/course-pack/environment';
import { makePilotPack } from './fixtures/lesson-variety';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.extend(toHaveNoViolations as any);

const pack = normalizePack(makePilotPack());
const env = (): CourseEnvironment => ({ capabilities: {accounts:false,synchronization:false,offlineInstall:false,hostedNavigation:false}, practice:{getDurability:()=> 'durable',subscribeDurability:()=>()=>{},read:async()=>[],write:async()=>{}},lessonPractice:createMemoryLessonPractice(),loadPack:vi.fn(),resolveMedia:(url)=>url });

it('story lesson has no axe violations on first render', { timeout: 20000 }, async () => {
  const { container } = render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={env()} onExit={()=>{}}/>);
  await screen.findByRole('button', { name: 'Continue' });
  expect(await axe(container)).toHaveNoViolations();
});

it('story lesson has no axe violations after feedback', { timeout: 20000 }, async () => {
  const { container } = render(<LessonPlayer pack={pack} lessonId="it-cafe-story" environment={env()} onExit={()=>{}}/>);
  await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Next step' }));
  await userEvent.click(await screen.findByRole('radio', { name: 'Un caffè' }));
  await userEvent.click(screen.getByRole('button', { name: 'Check' }));
  await screen.findByText(/Saved as independent practice/);
  expect(await axe(container)).toHaveNoViolations();
});

it('conversation lesson has no axe violations on first render', { timeout: 20000 }, async () => {
  const { container } = render(<LessonPlayer pack={pack} lessonId="it-cafe-conversation" environment={env()} onExit={()=>{}}/>);
  await screen.findByRole('button', { name: 'Continue' });
  expect(await axe(container)).toHaveNoViolations();
});

it('listening lesson has no axe violations on first render', { timeout: 20000 }, async () => {
  const { container } = render(<LessonPlayer pack={pack} lessonId="it-cafe-listening" environment={env()} onExit={()=>{}}/>);
  await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  await screen.findByLabelText('Lesson audio');
  expect(await axe(container)).toHaveNoViolations();
});
