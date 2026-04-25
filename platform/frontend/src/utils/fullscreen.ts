/**
 * Cross-browser Fullscreen API helpers (Chrome, Firefox, Safari desktop & iPad).
 * iOS Safari often does not support element fullscreen; callers should catch failures.
 */

type DocWithFs = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
  webkitCancelFullScreen?: () => void;
  mozCancelFullScreen?: () => void;
  msExitFullscreen?: () => void;
};

type ElWithFs = HTMLElement & {
  webkitRequestFullscreen?: () => void;
  webkitRequestFullScreen?: () => void;
  mozRequestFullScreen?: () => void;
  msRequestFullscreen?: () => void;
};

export function getFullscreenElement(): Element | null {
  const doc = document as DocWithFs;
  return (
    doc.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.mozFullScreenElement ??
    doc.msFullscreenElement ??
    null
  );
}

export async function enterFullscreen(el: HTMLElement): Promise<void> {
  const e = el as ElWithFs;
  try {
    if (e.requestFullscreen) {
      await e.requestFullscreen();
      return;
    }
    if (e.mozRequestFullScreen) {
      e.mozRequestFullScreen();
      return;
    }
    if (e.webkitRequestFullscreen) {
      e.webkitRequestFullscreen();
      return;
    }
    if (e.webkitRequestFullScreen) {
      e.webkitRequestFullScreen();
      return;
    }
    if (e.msRequestFullscreen) {
      e.msRequestFullscreen();
    }
  } catch {
    /* user gesture required, unsupported, etc. */
  }
}

export async function exitFullscreen(): Promise<void> {
  const doc = document as DocWithFs;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
      return;
    }
    if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
      return;
    }
    if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
      return;
    }
    if (doc.webkitCancelFullScreen) {
      doc.webkitCancelFullScreen();
      return;
    }
    doc.msExitFullscreen?.();
  } catch {
    /* noop */
  }
}
