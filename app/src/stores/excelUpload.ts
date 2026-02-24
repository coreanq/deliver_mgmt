import { create } from 'zustand';
import type { SharedFileInfo, FieldMapping, MappingSuggestion } from '../types';

export type UploadStep =
  | 'idle'
  | 'fileReceived'
  | 'parsing'
  | 'mapped'
  | 'saving'
  | 'complete';

interface ExcelUploadStore {
  step: UploadStep;
  pendingFile: SharedFileInfo | null;
  headers: string[];
  rows: Record<string, string>[];
  suggestions: MappingSuggestion[];
  mapping: FieldMapping | null;
  deliveryDate: string;
  error: string | null;
  isLoading: boolean;
  savedCount: number;

  setPendingFile: (file: SharedFileInfo) => void;
  setParsingData: (headers: string[], rows: Record<string, string>[]) => void;
  setSuggestions: (suggestions: MappingSuggestion[]) => void;
  setMapping: (mapping: FieldMapping) => void;
  setDeliveryDate: (date: string) => void;
  setStep: (step: UploadStep) => void;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setSavedCount: (count: number) => void;
  reset: () => void;
}

const initialState = {
  step: 'idle' as UploadStep,
  pendingFile: null,
  headers: [],
  rows: [],
  suggestions: [],
  mapping: null,
  deliveryDate: '',
  error: null,
  isLoading: false,
  savedCount: 0,
};

export const useExcelUploadStore = create<ExcelUploadStore>((set) => ({
  ...initialState,

  setPendingFile: (file) => set({ pendingFile: file, step: 'fileReceived', error: null }),

  setParsingData: (headers, rows) => set({ headers, rows, step: 'parsing' }),

  setSuggestions: (suggestions) => set({ suggestions, step: 'mapped' }),

  setMapping: (mapping) => set({ mapping }),

  setDeliveryDate: (date) => set({ deliveryDate: date }),

  setStep: (step) => set({ step }),

  setError: (error) => set({ error, isLoading: false }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setSavedCount: (count) => set({ savedCount: count }),

  reset: () => set(initialState),
}));
