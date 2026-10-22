'use client';

import type { ImageTarget } from '../../lib/ai-workbench';
import type { GeneratedImage } from '../../lib/generated-images';
import { useMemo, useReducer, type SetStateAction } from 'react';
export type AiImageCard = { id: string; brief: string; prompt: string; src: string; ratio?: string; target?: ImageTarget; visualStyle?: string; imageText?: string; status: 'idle' | 'loading' | 'done' | 'error'; error?: string };
export type AiRevision = { kind: 'polish' | 'title'; original: string; proposal: string; alternatives: string[]; from: number; to: number; wasHeading: boolean; insertAtStart?: boolean; status: 'running' | 'ready' | 'error'; error?: string };

export function useAiState() {
  const [state, updateAction] = useReducer((current: typeof initial, action: StateUpdate) => {
    const next = typeof action.value === 'function' ? action.value(current[action.key] as never) : action.value;
    return Object.is(current[action.key], next) ? current : { ...current, [action.key]: next };
  }, initial);
  const setters = useMemo(() => ({
    setAiPhase: (value: SetStateAction<typeof initial.aiPhase>) => updateValue('aiPhase', value),
    setAiRecommendation: (value: SetStateAction<typeof initial.aiRecommendation>) => updateValue('aiRecommendation', value),
    setAiSummary: (value: SetStateAction<typeof initial.aiSummary>) => updateValue('aiSummary', value),
    setAiTitleOptions: (value: SetStateAction<typeof initial.aiTitleOptions>) => updateValue('aiTitleOptions', value),
    setAiSuggestions: (value: SetStateAction<typeof initial.aiSuggestions>) => updateValue('aiSuggestions', value),
    setAiImageBriefs: (value: SetStateAction<typeof initial.aiImageBriefs>) => updateValue('aiImageBriefs', value),
    setAiImageCards: (value: SetStateAction<typeof initial.aiImageCards>) => updateValue('aiImageCards', value),
    setSavedGeneratedImages: (value: SetStateAction<typeof initial.savedGeneratedImages>) => updateValue('savedGeneratedImages', value),
    setAiRevision: (value: SetStateAction<typeof initial.aiRevision>) => updateValue('aiRevision', value),
    setRevisionInstruction: (value: SetStateAction<typeof initial.revisionInstruction>) => updateValue('revisionInstruction', value),
    setAiResultMode: (value: SetStateAction<typeof initial.aiResultMode>) => updateValue('aiResultMode', value),
  }), []);
  function updateValue<K extends keyof typeof initial>(key: K, value: SetStateAction<typeof initial[K]>) {
    updateAction({ key, value } as StateUpdate);
  }
  return { ...state, ...setters };
}

const initial = {
    aiPhase: 'entry' as 'entry' | 'running' | 'ready',
    aiRecommendation: 0,
    aiSummary: '',
    aiTitleOptions: [] as string[],
    aiSuggestions: [] as string[],
    aiImageBriefs: [] as string[],
    aiImageCards: [] as AiImageCard[],
    savedGeneratedImages: [] as GeneratedImage[],
    aiRevision: null as AiRevision | null,
    revisionInstruction: '',
    aiResultMode: 'full' as 'full' | 'layout' | 'images' | 'title',
};
type StateUpdate = { [K in keyof typeof initial]: { key: K; value: SetStateAction<typeof initial[K]> } }[keyof typeof initial];
