import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { beginSettingsTransition, finishExternalTransition } from './settings/restartTransition';
// A configuration change restarts the dev server: cover the stale page until the new one renders.
import.meta.hot?.on('studio:restarting', () => beginSettingsTransition({ external: true }));
const release = router.subscribe('onRendered', () => {
  release();
  finishExternalTransition();
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
