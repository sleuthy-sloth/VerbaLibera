"use client";

import { useEffect, useRef, useState } from "react";

export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "ready"
  | "unsupported"
  | "denied";

/**
 * In-memory voice practice: records via MediaRecorder and plays back from a Blob
 * URL, revoking it on unmount. Nothing is uploaded and nothing is persisted, so
 * a recording lives only in this tab and is gone when the learner moves on.
 *
 * Extracted from VoiceRecorder so the lesson player's `self-compare` step can
 * record too. That step already told the learner to "say your answer, then
 * compare it with the model" without giving them any way to hear themselves:
 * the speaking activity was wired end to end and could not actually record.
 *
 * The caller owns the UI, because the two surfaces have different design
 * systems (the guided session's `session.module.css`, the player's `lp-*`).
 */
export function useVoiceRecorder() {
  // Initialize to the SSR markup ('unsupported') and upgrade after mount so the
  // server HTML matches the first client render. Reading navigator.mediaDevices
  // during render causes a hydration mismatch on every lesson page (a full
  // client re-render, losing early interactions).
  const [state, setState] = useState<RecorderState>("unsupported");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const devices = navigator.mediaDevices as MediaDevices | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only upgrade from the SSR-safe initial state; reading mediaDevices during render causes a hydration mismatch.
    if (typeof devices?.getUserMedia === "function") setState("idle");
  }, []);

  useEffect(() => {
    const url = recordingUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordingUrl]);

  const start = async () => {
    if (state === "recording" || state === "requesting") return;
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecordingUrl(URL.createObjectURL(blob));
        setState("ready");
      };
      recorder.start();
      setState("recording");
    } catch {
      setState("denied");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const discard = () => {
    setRecordingUrl(null);
    setState("idle");
  };

  /** `unsupported` is the pre-mount state, so treat it as "not yet known". */
  const canRecord = state !== "unsupported" && state !== "denied";

  return { state, recordingUrl, start, stop, discard, canRecord };
}
