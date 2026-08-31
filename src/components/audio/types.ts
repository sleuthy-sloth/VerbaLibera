export type AudioSegment = {
  id: string;
  url: string;
  type: 'prompt' | 'answer';
  pauseAfter: boolean;
  transcript?: string;
};

export type AudioPlayerHandle = {
  completeThinking(): void;
  restart(): void;
};

export type AudioPlayerProps = {
  segments: readonly AudioSegment[];
  onThinkComplete?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
};
