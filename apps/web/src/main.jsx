import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createMediaClient } from '@foto-owl/media-core';
import { MediaProvider } from '@foto-owl/media-react';
import App from './App.jsx';
import './styles/app.css';

const apiKey = import.meta.env.VITE_PEXELS_API_KEY;
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root was not found.');

createRoot(rootElement).render(<StrictMode>{apiKey ? <MediaProvider client={createMediaClient({ apiKey, logger: console })}><App /></MediaProvider> : <main className="configuration-error"><h1>One quick setup step</h1><p>Add your Pexels API key to <code>apps/web/.env</code> as <code>VITE_PEXELS_API_KEY</code>, then restart the development server.</p></main>}</StrictMode>);
