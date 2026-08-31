export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type DrillKind = 'SUBSTITUTION' | 'TRANSFORMATION';

export type AudioSegmentType = 'PROMPT' | 'ANSWER';

export type AssessmentResult = 'PASS' | 'FAIL' | 'INCOMPLETE';

export type ContentProvenance = 'ORIGINAL' | 'IMPORTED';

export type AudioSegmentFixture = Readonly<{
  id: string;
  type: AudioSegmentType;
  position: number;
  pauseAfter: boolean;
  audioUrl: string;
  transcript?: string;
  durationMs?: number;
  contentProvenance: ContentProvenance;
}>;

export type DrillFixture = Readonly<{
  id: string;
  conceptId: string;
  cefrLevel: CEFRLevel;
  kind: DrillKind;
  prompt: string;
  acceptedResponses: readonly string[];
  recallTarget: string;
  contentProvenance: ContentProvenance;
}>;

export type ConceptFixture = Readonly<{
  id: string;
  position: number;
  cefrLevel: CEFRLevel;
  title: string;
  explanation: string;
  assessmentCriteria: string;
  contentProvenance: ContentProvenance;
  audioSegments: readonly AudioSegmentFixture[];
  drills: readonly DrillFixture[];
}>;

export type CourseFixture = Readonly<{
  slug: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  title: string;
  description: string;
  concepts: readonly ConceptFixture[];
}>;
