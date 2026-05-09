import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type AppState = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(
      () => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
      toast.duration ?? 3000,
    );
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clearToasts: () => set({ toasts: [] }),
}));

export function toast(message: string, type: ToastType = 'info', duration?: number) {
  useAppStore.getState().addToast({ message, type, duration });
}
