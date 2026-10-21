'use client';

import { useMemo, useReducer, type SetStateAction } from 'react';
import { styles } from '../../lib/styles';

export function useAppearanceState() {
  const [state, updateAction] = useReducer((current: typeof initial, action: StateUpdate) => {
    const next = typeof action.value === 'function' ? action.value(current[action.key] as never) : action.value;
    return Object.is(current[action.key], next) ? current : { ...current, [action.key]: next };
  }, initial);
  const setters = useMemo(() => ({
    setStyle: (value: SetStateAction<typeof initial.style>) => updateValue('style', value),
    setAccent: (value: SetStateAction<typeof initial.accent>) => updateValue('accent', value),
    setMarkerColor: (value: SetStateAction<typeof initial.markerColor>) => updateValue('markerColor', value),
    setVariant: (value: SetStateAction<typeof initial.variant>) => updateValue('variant', value),
    setFontSize: (value: SetStateAction<typeof initial.fontSize>) => updateValue('fontSize', value),
    setLineHeight: (value: SetStateAction<typeof initial.lineHeight>) => updateValue('lineHeight', value),
    setPadX: (value: SetStateAction<typeof initial.padX>) => updateValue('padX', value),
    setPadY: (value: SetStateAction<typeof initial.padY>) => updateValue('padY', value),
    setImageRadius: (value: SetStateAction<typeof initial.imageRadius>) => updateValue('imageRadius', value),
    setPaperMode: (value: SetStateAction<typeof initial.paperMode>) => updateValue('paperMode', value),
    setPaperTextureUrl: (value: SetStateAction<typeof initial.paperTextureUrl>) => updateValue('paperTextureUrl', value),
    setPaperColor: (value: SetStateAction<typeof initial.paperColor>) => updateValue('paperColor', value),
    setParagraphGap: (value: SetStateAction<typeof initial.paragraphGap>) => updateValue('paragraphGap', value),
    setFontFamily: (value: SetStateAction<typeof initial.fontFamily>) => updateValue('fontFamily', value),
    setFontColor: (value: SetStateAction<typeof initial.fontColor>) => updateValue('fontColor', value),
    setHeadingStyle: (value: SetStateAction<typeof initial.headingStyle>) => updateValue('headingStyle', value),
    setHeadingIcon: (value: SetStateAction<typeof initial.headingIcon>) => updateValue('headingIcon', value),
    setHeadingLabels: (value: SetStateAction<typeof initial.headingLabels>) => updateValue('headingLabels', value),
    setHeadingPrefixes: (value: SetStateAction<typeof initial.headingPrefixes>) => updateValue('headingPrefixes', value),
    setHeadingSeparators: (value: SetStateAction<typeof initial.headingSeparators>) => updateValue('headingSeparators', value),
    setHeadingNumberFormat: (value: SetStateAction<typeof initial.headingNumberFormat>) => updateValue('headingNumberFormat', value),
  }), []);
  function updateValue<K extends keyof typeof initial>(key: K, value: SetStateAction<typeof initial[K]>) {
    updateAction({ key, value } as StateUpdate);
  }
  return { ...state, ...setters };
}

const initial = {
    style: 0,
    accent: styles[0].accent,
    markerColor: '#fff07a',
    variant: '标准',
    fontSize: styles[0].reading.fontSize,
    lineHeight: styles[0].reading.lineHeight,
    padX: styles[0].reading.padX,
    padY: styles[0].reading.padY,
    imageRadius: styles[0].reading.imageRadius,
    paperMode: 'style' as 'follow' | 'style' | 'custom',
    paperColor: '#ffffff',
    paperTextureUrl: '',
    paragraphGap: 16,
    fontFamily: styles[0].typography.fontFamily,
    fontColor: '',
    headingStyle: 'bar',
    headingIcon: '◆',
    headingLabels: {} as Record<string, string>,
    headingPrefixes: {} as Record<string, string>,
    headingSeparators: {} as Record<string, string>,
    headingNumberFormat: '01' as '01' | '1' | '一' | 'none',
};
type StateUpdate = { [K in keyof typeof initial]: { key: K; value: SetStateAction<typeof initial[K]> } }[keyof typeof initial];
