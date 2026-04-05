import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress environment-related errors from browser extensions (e.g., MetaMask)
// these occur because extensions try to inject properties into the sandboxed preview window.
if (typeof window !== 'undefined') {
  const suppressKeywords = ['ethereum', 'property descriptor', 'proxy', 'accessors', 'invalid property descriptor'];
  
  // Aggressively suppress console.error
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args.map(arg => {
      try {
        return arg?.toString() || '';
      } catch {
        return '';
      }
    }).join(' ');
    if (suppressKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      return;
    }
    originalError.apply(console, args);
  };

  // Catch unhandled errors and rejections
  const handleError = (event: ErrorEvent | PromiseRejectionEvent) => {
    let message = '';
    if (event instanceof ErrorEvent) {
      message = event.message || '';
    } else if (event instanceof PromiseRejectionEvent) {
      message = event.reason?.message || event.reason?.toString() || '';
    }
    
    if (suppressKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    return false;
  };

  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleError, true);

  // Aggressively override Object.defineProperty to prevent the error from being thrown
  // by browser extensions that pass invalid descriptors.
  const originalDefineProperty = Object.defineProperty;
  Object.defineProperty = function(obj, prop, descriptor) {
    try {
      return originalDefineProperty.call(this, obj, prop, descriptor);
    } catch (e: any) {
      const message = e?.message || String(e);
      if (suppressKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
        // Suppress the error and return the object as is
        return obj;
      }
      throw e;
    }
  } as any;

  // Pre-emptively define ethereum to prevent "only a getter" errors if possible
  // or at least catch the assignment error.
  try {
    if (!('ethereum' in window)) {
      let eth: any = undefined;
      originalDefineProperty.call(Object, window, 'ethereum', {
        get() { return eth; },
        set(val) { eth = val; },
        configurable: true,
        enumerable: true
      });
    }
  } catch (e) {
    // Ignore errors during pre-emptive definition
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
