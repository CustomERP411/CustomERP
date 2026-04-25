const { EventEmitter } = require('events');

/**
 * Minimal archiver stub for unit tests.
 *
 * Production `archiver(format, opts)` returns a stream-like object
 * with `.on`, `.pipe(dest)`, `.directory(dir, nameOrFalse)`, and
 * `.finalize()`. We only need enough surface area so code under test
 * can invoke these without touching the file system or spawning any
 * compression work — the caller in `streamZipFromDir` resolves when
 * the response stream emits 'finish' / 'close'.
 */
function archiver() {
  const emitter = new EventEmitter();

  const archive = {
    on: emitter.on.bind(emitter),
    pipe(dest) {
      archive._dest = dest;
      // Fire 'finish' on the response on the next tick so the
      // streamZipFromDir Promise can resolve.
      setImmediate(() => {
        if (dest && typeof dest.emit === 'function') {
          dest.emit('finish');
        }
      });
      return dest;
    },
    directory() {},
    finalize() {},
  };

  return archive;
}

module.exports = archiver;
