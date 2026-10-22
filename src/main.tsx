import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadState } from './store';
import './style.css';

function reportError(event: ErrorEvent | PromiseRejectionEvent) {
  const error = 'reason' in event ? event.reason : event.error;
  const element = document.getElementById('runtime-error') ?? document.createElement('div');
  element.id = 'runtime-error';
  element.setAttribute('role', 'alert');
  element.textContent = `操作未完成：${error instanceof Error ? error.message : String(error)}。请刷新页面后检查数据。`;
  document.body.append(element);
}
window.addEventListener('error', reportError);
window.addEventListener('unhandledrejection', reportError);
const state = await loadState();
createRoot(document.getElementById('root')!).render(<React.StrictMode><App initial={state} /></React.StrictMode>);
