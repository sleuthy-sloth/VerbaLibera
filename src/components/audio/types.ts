export type AudioSegment = {
  id: string;
  url: string;
  type: 'prompt' | 'answer';
  pauseAfter: boolean;
  transcript?: string;
};

export type AudioPlayerHandle = {
  completeResponseTurn(): void;
  restart(): void;
};

export type AudioPlayerProps = {
  segments: readonly AudioSegment[];
  onResponseTurnComplete?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
};
