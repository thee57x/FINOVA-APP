import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress environment-related errors from browser extensions (e.g., MetaMask)
// these occur because extensions try to inject properties into the sandboxed preview window.
if (typeof window !== 'undefined') {
  const suppressKeywords = ['ethereum', 'property descriptor', 'proxy', 'accessors', 'invalid property descriptor', 'cannot set property ethereum'];
  
  // Aggressively suppress console.error
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args.map(arg => {
      try {
        if (typeof arg === 'string') return arg;
        return JSON.stringify(arg);
      } catch {
        return String(arg);
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
        return obj;
      }
      throw e;
    }
  } as any;

  // Also override Object.defineProperties
  const originalDefineProperties = Object.defineProperties;
  Object.defineProperties = function(obj, props) {
    try {
      return originalDefineProperties.call(this, obj, props);
    } catch (e: any) {
      const message = e?.message || String(e);
      if (suppressKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
        return obj;
      }
      throw e;
    }
  } as any;

  // Pre-emptively define ethereum to prevent "only a getter" errors
  try {
    let eth: any = undefined;
    originalDefineProperty.call(Object, window, 'ethereum', {
      get() { return eth; },
      set(val) { eth = val; },
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    // If it fails, it's likely already defined as non-configurable
    // We try to at least make it writable if possible, but usually we can't if it's non-configurable
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
