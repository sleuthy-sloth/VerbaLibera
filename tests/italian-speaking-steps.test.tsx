import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ActivityView } from '@/features/course-pack/activities/ActivityView';
import { normalizePack } from '@/features/course-pack/normalize-pack';

/**
 * The Italian course is the only pack that uses the player's `self-compare`
 * activity, which is what makes it the only place a learner is ever asked to
 * speak. These run against the real authored pack rather than a fixture, because
 * the failure mode here is content-shaped: the spoken line is lifted from an
 * exercise that already exists, and picking the wrong one produces a speaking
 * step whose model sentence is English.
 */

type Activity = {
  id: string;
  kind: string;
  skills?: string[];
  prompt: string;
  modelText?: string;
  modelAudioId?: string;
  stimulusId?: string;
  answer?: { answers?: string[] };
};
type Lesson = { id: string; steps: { id: string; activityId: string; nextStepId?: string; required?: boolean }[] };

const doc = JSON.parse(
  readFileSync(resolve(__dirname, '../courses/italian/manifest.json'), 'utf8'),
) as {
  activities: Activity[];
  lessons: Lesson[];
  media: { id: string }[];
  stimuli: { id: string; kind: string; mediaId?: string }[];
};

const byId = new Map(doc.activities.map((a) => [a.id, a]));
const speaking = doc.activities.filter((a) => a.kind === 'self-compare');
const mediaIds = new Set(doc.media.map((m) => m.id));
const stimulusById = new Map(doc.stimuli.map((s) => [s.id, s]));

it('gives every lesson past the first two a speaking step that is really in its path', () => {
  const taught = doc.lessons.slice(2);
  expect(speaking).toHaveLength(taught.length);

  for (const lesson of taught) {
    const saySteps = lesson.steps.filter((s) => s.id.endsWith('-say'));
    expect(saySteps, `${lesson.id} should have exactly one speaking step`).toHaveLength(1);

    const step = saySteps[0];
    const activity = byId.get(step.activityId);
    expect(activity?.kind, `${lesson.id} say step points at a self-compare`).toBe('self-compare');
    expect(activity?.skills).toContain('speaking');
    // Reached from somewhere: either the entry, or a step that points at it.
    const reached = lesson.steps.some((s) => s.nextStepId === step.id);
    expect(reached || lesson.steps[0].id === step.id, `${lesson.id} say step is unreachable`).toBe(true);
  }
});

it('never asks the learner to say an English sentence out loud', () => {
  // `text` covers both directions. A speaking step built from a meaning exercise
  // (skills reading/vocabulary) would put English in modelText. The line must
  // come from a production exercise instead, and must match its accepted answer.
  for (const activity of speaking) {
    const source = doc.activities.find(
      (a) => a.kind === 'text' && a.skills?.includes('writing') && a.answer?.answers?.[0] === activity.modelText,
    );
    expect(source, `${activity.id} takes its line from a production exercise`).toBeDefined();
    expect(activity.modelText?.trim(), `${activity.id} has a spoken line`).toBeTruthy();
  }
});

it('only attaches model audio that plays the same sentence', () => {
  for (const activity of speaking) {
    if (!activity.modelAudioId) continue;
    expect(mediaIds.has(activity.modelAudioId), `${activity.id} audio exists`).toBe(true);

    // The clip is the lesson's model recording, identified through the listening
    // activity's audio stimulus. That activity must accept the SAME sentence, or
    // the learner compares their pronunciation against a different one, which is
    // worse than offering no model audio at all.
    const listener = doc.activities.find((a) => {
      const stimulus = a.stimulusId ? stimulusById.get(a.stimulusId) : undefined;
      return stimulus?.kind === 'audio' && stimulus.mediaId === activity.modelAudioId;
    });
    expect(listener, `${activity.id} reuses a real listening clip`).toBeDefined();
    expect(listener?.answer?.answers?.[0], `${activity.id} audio matches the spoken line`).toBe(
      activity.modelText,
    );
  }
});

it('renders a real authored speaking step through the real renderer', async () => {
  const pack = normalizePack(JSON.parse(readFileSync(resolve(__dirname, '../courses/italian/manifest.json'), 'utf8')));
  const activity = speaking[0];
  const onChange = vi.fn();
  const onAssist = vi.fn();

  render(
    <ActivityView
      activity={activity as never}
      response={null}
      disabled={false}
      onChange={onChange}
      onAssist={onAssist}
    />,
  );

  // The model is hidden until the learner has produced the line.
  expect(screen.queryByText(activity.modelText!)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Reveal comparison model' }));
  expect(screen.getByText(activity.modelText!)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Comfortable' }));
  expect(onChange).toHaveBeenCalledWith({ kind: 'self', rating: 'comfortable' });
  expect(pack.activities[activity.id]).toBeDefined();
});
