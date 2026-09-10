import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import Snackbar, {
  type SnackbarMessage,
  type SnackbarVariant,
} from './Snackbar';

const ERROR_DURATION_MS = 4500;
const DEFAULT_DURATION_MS = 2800;

type SnackbarContextValue = {
  showError: (text: string) => void;
  showInfo: (text: string) => void;
  showMessage: (text: string, variant: SnackbarVariant) => void;
  showSuccess: (text: string) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | undefined>(undefined);

type SnackbarViewContextValue = {
  dismiss: () => void;
  message: SnackbarMessage | null;
};

const SnackbarViewContext = createContext<SnackbarViewContextValue>({
  dismiss: () => {},
  message: null,
});

// En iOS un Modal de React Native se presenta desde el view controller raíz sin
// recorrer la cadena de modales ya presentados, así que un snackbar montado en
// la raíz nunca aparece mientras hay un modal abierto. La solución es montar un
// host adicional DENTRO de cada modal que pueda mostrar mensajes: todos leen el
// mismo estado, y el que queda tapado simplemente no se ve.
export function SnackbarHost() {
  const { dismiss, message } = useContext(SnackbarViewContext);

  return <Snackbar message={message} onDismiss={dismiss} />;
}

// Vía imperativa para disparar mensajes desde servicios o desde código que
// corre antes de que monte el provider (por ejemplo la inicialización de
// anuncios en App.tsx). Sigue el mismo patrón que navigationService.
let externalHandler: ((text: string, variant: SnackbarVariant) => void) | null = null;
const pendingMessages: Array<{ text: string; variant: SnackbarVariant }> = [];

export function showSnackbar(text: string, variant: SnackbarVariant = 'error') {
  if (externalHandler) {
    externalHandler(text, variant);
    return;
  }

  pendingMessages.push({ text, variant });
}

export function getSnackbarErrorText(error: unknown, fallback: string) {
  // Los errores de Supabase (PostgrestError) son objetos planos, no instancias
  // de Error, así que sin este segundo caso el motivo real (violación de RLS,
  // not null, uuid inválido) nunca llega al usuario.
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message?: unknown };

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);

  if (!context) {
    throw new Error('useSnackbar debe usarse dentro de un SnackbarProvider.');
  }

  return context;
}

export default function SnackbarProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<SnackbarMessage | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setMessage(null);
  }, []);

  const showMessage = useCallback(
    (text: string, variant: SnackbarVariant) => {
      const trimmed = text?.trim();

      if (!trimmed) {
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      idRef.current += 1;
      setMessage({ id: idRef.current, text: trimmed, variant });

      timerRef.current = setTimeout(
        () => setMessage(null),
        variant === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS,
      );
    },
    [],
  );

  useEffect(() => {
    externalHandler = showMessage;

    // Vacío la cola de mensajes que se dispararon antes de montar.
    while (pendingMessages.length > 0) {
      const pending = pendingMessages.shift();

      if (pending) {
        showMessage(pending.text, pending.variant);
      }
    }

    return () => {
      externalHandler = null;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [showMessage]);

  const value = useMemo<SnackbarContextValue>(
    () => ({
      showError: (text: string) => showMessage(text, 'error'),
      showInfo: (text: string) => showMessage(text, 'info'),
      showMessage,
      showSuccess: (text: string) => showMessage(text, 'success'),
    }),
    [showMessage],
  );

  const viewValue = useMemo<SnackbarViewContextValue>(
    () => ({ dismiss, message }),
    [dismiss, message],
  );

  return (
    <SnackbarContext.Provider value={value}>
      <SnackbarViewContext.Provider value={viewValue}>
        {children}
        <SnackbarHost />
      </SnackbarViewContext.Provider>
    </SnackbarContext.Provider>
  );
}
