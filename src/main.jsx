import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AppProvider } from './lib/context.jsx';
import { queryClient } from './lib/queryClient.js';
import { loadDataSource } from './data/dataSource.js';
import './index.css';

// Etapa 4: bloquear el render hasta tener el flag desde config/dataSource. La suscripción
// queda activa; cualquier cambio posterior recarga la app (rollback instantáneo).
loadDataSource().then((flag) => {
  // eslint-disable-next-line no-console
  console.info('[dataSource] loaded', flag);
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AppProvider>
            <App />
          </AppProvider>
        </HashRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
});
