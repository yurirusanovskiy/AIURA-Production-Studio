'use client';

import * as React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import theme from '@/theme';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { NotificationContainer } from '@/components/NotificationContainer';
import { notificationService } from '@/lib/notifications';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.meta?.preventGlobalError) return;
            notificationService.error(error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, variables, context, mutation) => {
            if (mutation.meta?.preventGlobalError) return;
            notificationService.error(error);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouterCacheProvider options={{ enableCssLayer: true }}>
        <ThemeProvider theme={theme}>
          {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
          <CssBaseline />
          {children}
          <NotificationContainer />
        </ThemeProvider>
      </AppRouterCacheProvider>
    </QueryClientProvider>
  );
}
