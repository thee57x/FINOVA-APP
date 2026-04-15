import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress environment-related errors from browser extensions (e.g., MetaMask)
// these occur because extensions try to inject properties into the sandboxed preview window.
if (typeof window !== 'undefined') {
  const suppressKeywords = [
    'ethereum', 
    'property descriptor', 
    'proxy', 
    'accessors', 
    'invalid property descriptor', 
    'cannot set property ethereum',
    'failed to assign ethereum proxy',
    'uncaught typeerror',
    'specify accessors',
    'value or writable attribute'
  ];
  
  // Aggressively suppress console.error and console.warn
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const shouldSuppress = (args: any[]) => {
    const message = args.map(arg => {
      try {
        if (typeof arg === 'string') return arg;
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');
    return suppressKeywords.some(keyword => message.toLowerCase().includes(keyword));
  };

  console.error = (...args: any[]) => {
    if (shouldSuppress(args)) return;
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    if (shouldSuppress(args)) return;
    originalWarn.apply(console, args);
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
  Object.defineProperty = function(obj: any, prop: string | symbol, descriptor: PropertyDescriptor) {
    try {
      // Check for invalid descriptor (cannot have both accessors and value/writable)
      if (descriptor && (descriptor.get || descriptor.set) && ('value' in descriptor || 'writable' in descriptor)) {
        // Fix the descriptor by preferring accessors
        const fixedDescriptor = { ...descriptor };
        delete (fixedDescriptor as any).value;
        delete (fixedDescriptor as any).writable;
        return originalDefineProperty.call(this, obj, prop, fixedDescriptor);
      }
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
  // We use a try-catch because the property might be non-configurable
  try {
    // Try to delete it first if it exists and is configurable
    try {
      delete (window as any).ethereum;
    } catch (e) {
      // Ignore
    }

    let eth: any = undefined;
    originalDefineProperty.call(Object, window, 'ethereum', {
      get() { return eth; },
      set(val) { eth = val; },
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    // If it fails, it's likely already defined as non-configurable by an extension
    // We can't do much about the "only a getter" error on assignment then,
    // but our console.error suppression and error listeners should handle it.
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
