# HR Generator Wiring (Phase 5)

Date: 2026-02-24  
Author: ODD  

## Summary
- Added HR module validation in the assembler (required entities + fields).
- Wired HR backend mixins for `employees`, `departments`, and `leaves` when entities are in module `hr`.

## Notes
- HR entity layout remains module-based (`modules/hr/`), consistent with multi-module generation.
- Frontend HR pages are handled separately by EA.
