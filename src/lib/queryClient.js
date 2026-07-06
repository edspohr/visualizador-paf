import { QueryClient } from '@tanstack/react-query';

// Cache config para lecturas de catálogo:
//   staleTime: 5 min — el catálogo cambia raramente
//   gcTime: 30 min — retener en cache aunque el componente se desmonte
//   refetchOnWindowFocus: false — no queremos gastar lecturas cada vez que Luis cambia de pestaña
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
