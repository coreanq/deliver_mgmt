import { create } from 'zustand';

interface UploadState {
  // 파싱된 데이터
  headers: string[];
  rows: Record<string, string>[];
  // 매핑 설정
  mapping: Record<string, string>;
  // 상태
  step: 'upload' | 'mapping' | 'confirm';
  isLoading: boolean;
  error: string | null;
}

interface UploadActions {
  setData: (headers: string[], rows: Record<string, string>[]) => void;
  setMapping: (mapping: Record<string, string>) => void;
  updateMapping: (targetField: string, sourceColumn: string) => void;
  setStep: (step: UploadState['step']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: UploadState = {
  headers: [],
  rows: [],
  mapping: {},
  step: 'upload',
  isLoading: false,
  error: null,
};

export const useUploadStore = create<UploadState & UploadActions>((set) => ({
  ...initialState,

  setData: (headers, rows) => {
    set({ headers, rows, step: 'mapping', error: null });
  },

  setMapping: (mapping) => {
    set({ mapping });
  },

  updateMapping: (targetField, sourceColumn) => {
    set((state) => ({
      mapping: { ...state.mapping, [targetField]: sourceColumn },
    }));
  },

  setStep: (step) => {
    set({ step });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  reset: () => {
    set(initialState);
  },
}));
