/**
 * UC-7.7 Download ERP — safeFileName sanitization tests
 *
 * Covers TC-UC7.7-008, TC-UC7.7-009.
 * SUT: platform/backend/src/services/erpGenerationService.js
 *
 * `safeFileName` is not exported, so we observe its behaviour through
 * `streamZipFromDir` which feeds it into the `Content-Disposition`
 * response header. `archiver` is stubbed globally via jest.config
 * `moduleNameMapper` so these tests never touch the file system.
 */

const { EventEmitter } = require('events');

const erpGenerationService = require(
  '../../../../platform/backend/src/services/erpGenerationService',
);

function mockRes() {
  const res = new EventEmitter();
  res.setHeader = jest.fn();
  return res;
}

describe('UC-7.7 / erpGenerationService.safeFileName (observed via streamZipFromDir)', () => {
  // TC-UC7.7-008
  test('TC-UC7.7-008 — path traversal characters collapse to hyphens in the Content-Disposition header', async () => {
    const res = mockRes();
    await erpGenerationService.streamZipFromDir(res, {
      outputDir: '/tmp/fake',
      zipName: '../../etc/passwd',
    });

    const cd = res.setHeader.mock.calls.find((c) => c[0] === 'Content-Disposition');
    expect(cd).toBeDefined();
    const value = cd[1];
    // filename="etc-passwd.zip" — no slashes, no dots other than .zip,
    // no leading hyphens.
    expect(value).toMatch(/^attachment; filename="[\w-]+\.zip"$/);
    expect(value).not.toMatch(/[/\\]/);
    expect(value).not.toMatch(/\.\./);
    // The first alpha characters come from 'etc', but the exact shape
    // is implementation detail; the key invariant is that there is no
    // traversal sequence left in the filename.
    expect(value.toLowerCase()).toContain('etc');
    expect(value.toLowerCase()).toContain('passwd');
  });

  // TC-UC7.7-009
  test('TC-UC7.7-009 — Turkish / Unicode filenames collapse to hyphens but always yield a non-empty safe name', async () => {
    const res = mockRes();
    await erpGenerationService.streamZipFromDir(res, {
      outputDir: '/tmp/fake',
      zipName: 'Şirket Projesi',
    });

    const cd = res.setHeader.mock.calls.find((c) => c[0] === 'Content-Disposition');
    expect(cd).toBeDefined();
    const value = cd[1];

    // Must produce a safe attachment filename; never empty, never
    // still-containing whitespace or raw non-ASCII \w characters.
    expect(value).toMatch(/^attachment; filename="[A-Za-z0-9_-]+\.zip"$/);
    // A completely non-ASCII input must NOT degrade to an empty name —
    // the function falls back to 'custom-erp'.
    // We don't assert the exact transformation because Node's `\w`
    // behaviour on Turkish letters is platform-dependent; what we
    // *do* assert is that a safe, non-empty filename was produced.
    const filename = value.match(/filename="([^"]+)"/)[1];
    expect(filename.length).toBeGreaterThan(0);
    expect(filename.endsWith('.zip')).toBe(true);
  });

  // Extra sanity: completely empty / null zip names still produce the
  // default 'custom-erp' filename (not a crash, not an empty name).
  test('empty / whitespace / null zipName falls back to "custom-erp.zip"', async () => {
    for (const zipName of ['', '   ', null, undefined, '!!!']) {
      const res = mockRes();
      await erpGenerationService.streamZipFromDir(res, {
        outputDir: '/tmp/fake',
        zipName,
      });
      const cd = res.setHeader.mock.calls.find((c) => c[0] === 'Content-Disposition');
      expect(cd[1]).toBe('attachment; filename="custom-erp.zip"');
    }
  });
});
