import { createRoot } from 'react-dom/client';
import { App } from './App';

document.documentElement.lang = 'pt-PT';
const el = document.getElementById('root')!;
createRoot(el).render(<App />);
