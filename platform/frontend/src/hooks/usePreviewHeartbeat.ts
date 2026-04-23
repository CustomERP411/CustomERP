import { useEffect } from 'react';
import { projectService } from '../services/projectService';

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * While the preview is in a non-terminal state, ping the backend every 20s so
 * the backend's heartbeat sweeper keeps the child ERP alive. When the user
 * leaves the page we stop pinging and the backend reclaims resources within
 * `PREVIEW_HEARTBEAT_GRACE_MS` (default 60s).
 */
export function usePreviewHeartbeat(projectId: string | undefined, active: boolean) {
  useEffect(() => {
    if (!projectId || !active) return;
    let cancelled = false;

    const send = () => {
      if (cancelled) return;
      projectService.heartbeatPreview(projectId).catch(() => {
        // silent — the next heartbeat (or the unmount cleanup) will handle it
      });
    };

    send();
    const timer = window.setInterval(send, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projectId, active]);
}
