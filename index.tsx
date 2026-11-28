import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { ToastProvider } from './src/context/ToastContext';
import './src/styles/index.css';
import 'react-diff-view/style/index.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
} from 'chart.js';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppContextProvider } from './src/context/AppContext';
import { WorkspaceProvider } from './src/context/WorkspaceContext';
import { TabsProvider } from './src/context/TabsContext';
import { LogProvider } from './src/context/LogContext';
import { BulkProvider } from './src/context/BulkContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <ThemeProvider>
        <AppContextProvider>
          <WorkspaceProvider>
            <TabsProvider>
              <LogProvider>
                <BulkProvider>
                  <App />
                </BulkProvider>
              </LogProvider>
            </TabsProvider>
          </WorkspaceProvider>
        </AppContextProvider>
      </ThemeProvider>
    </ToastProvider>
  </React.StrictMode>
);