---
title: Last Sprint (TE) Test Plan
---

## 1. Amaç

Bu plan, `progressreport.md` içindeki **Last Sprint** bölümünde `(TE)` ile biten görevler için hazırlanmıştır:

- `Run default-question-to-prefilled-SDF flow tests and regression checks. (TE)`
- `Run module-capability regression scenarios for new mixins/pages. (TE)`
- `Run generated ERP database-mode verification across inventory, invoice, and hr outputs. (TE)`

Bu doküman, `docs/sprint3_te_test_plan.md` ile aynı yaklaşımı kullanır: adım adım komutlar, beklenen çıktı ve hata/retest süreci.

## 2. Kapsam ve Hedef Eşlemesi

### 2.1 LS-TE-39
**Default question -> prefilled SDF akış testi + regresyon**

- Zorunlu soru şablonları yükleniyor mu?
- Cevaplar kaydolunca `prefilled_sdf` üretiliyor mu?
- Soru tamamlama kontrolü (`is_complete`) doğru çalışıyor mu?

### 2.2 LS-TE-40
**Yeni mixin/page capability regresyonları**

- Invoice/HR brick davranışları korunuyor mu?
- Assembler çıktılarında modül wire-up bozulması var mı?
- UI flow checklist adımları çalışıyor mu?

### 2.3 LS-TE-41
**Generated ERP database-mode doğrulaması (inventory, invoice, hr)**

- Üretilen backend repository altyapısı DB tabanlı mı?
- Migrasyon dosyaları ve DB provider mevcut mu?
- Flat-file kalıntısı var mı?

## 3. Ön Koşullar (Step 0)

1. Servisleri başlat:
   - Windows: `.\scripts\dev.ps1 start`
   - macOS/Linux: `./scripts/dev.sh start`
2. Health kontrol:
   - Backend: `http://localhost:3000/health`
   - AI Gateway: `http://localhost:8000/health`
3. İsteğe bağlı hızlı kontrat kontrol:
   - `node test/sprint3_te_regression.test.js`

## 4. Adım Adım Uygulama

### 4.1 LS-TE-39 — Default Questions -> Prefilled SDF

#### A) Otomatik kontrat/regresyon (hızlı)

```bash
node test/sprint3_te_regression.test.js
```

Beklenen:

- default-question endpoint ve analyze-gating kontrolleri `PASS`.

#### B) E2E akış doğrulaması (single + multi module)

```bash
node test/sprint3_te_objectives.e2e.test.js --objectives=131 --single-modules=invoice --multi-modules=inventory,invoice,hr
```

Beklenen:

- single ve multi senaryo projeleri oluşur,
- mandatory sorular answer edilip `prefilled_sdf` üretilir,
- analyze/clarify döngüsü çalışır,
- objective 131 sonucu `PASS` olur.

Not:

- AI erişimi yoksa bu adım `FAIL/BLOCKED` olabilir; bu durumda defect log'a işleyin.

### 4.2 LS-TE-40 — Module Capability Regression (New Mixins/Pages)

Aşağıdaki regresyon komutlarını sırayla çalıştır:

```bash
node test/verify_features_ea.js
node test/invoice_bricks.unit.test.js
node test/hr_bricks.unit.test.js
node test/module_generation.integration.test.js
```

Ardından route surface kontrolü:

```bash
node platform/backend/tests/api_invoice_hr_routes.test.js
```

Manual UI kontrol:

- `test/ui_invoice_hr.flows.test.md` adımlarını çalıştır.

Beklenen:

- Brick unit testleri `PASS`,
- capability verification script `PASS`,
- UI checklist kritik hata üretmez.

### 4.3 LS-TE-41 — Generated ERP Database-Mode Verification

#### A) ERP artifact üretimi (invoice, hr, inventory kapsaması)

```bash
node test/run_assembler.js test/sample_sdf_invoice.json
node test/run_assembler.js test/sample_sdf_hr.json
node test/run_assembler.js test/sample_sdf_multi_module.json
```

> `sample_sdf_multi_module.json` inventory + invoice kapsar; `sample_sdf_hr.json` ile birlikte inventory/invoice/hr kapsamı tamamlanır.

#### B) Her artifact içinde DB-mode dosya doğrulaması

Üretilen her proje için (çıktı yolu `generated/<project-id>`):

1. Aşağıdaki dosyaların varlığını doğrula:
   - `backend/src/repository/db.js`
   - `backend/src/repository/PostgresProvider.js`
   - `backend/src/repository/runMigrations.js`
2. Flat-file kalıntısı kontrolü:

```powershell
Get-ChildItem .\backend\src -Recurse -Filter *.js | Select-String -Pattern "FlatFileProvider"
```

Beklenen:

- Çıktı boş olmalı (eşleşme olmamalı).

3. Backend bağımlılık doğrulaması:

```powershell
Select-String -Path ".\backend\package.json" -Pattern "\"pg\""
```

Beklenen:

- `pg` bağımlılığı görünmeli.

#### C) Runtime DB-mode smoke

Generated proje backend klasöründe:

```bash
npm install
npm run migrate
npm start
```

Beklenen:

- Uygulama ayağa kalkar,
- health endpoint başarılı döner.

## 5. Önerilen Çalıştırma Sırası

1. `node test/sprint3_te_regression.test.js`
2. `node test/sprint3_te_objectives.e2e.test.js --objectives=131 --single-modules=invoice --multi-modules=inventory,invoice,hr`
3. `node test/verify_features_ea.js`
4. `node test/invoice_bricks.unit.test.js`
5. `node test/hr_bricks.unit.test.js`
6. `node test/module_generation.integration.test.js`
7. `node platform/backend/tests/api_invoice_hr_routes.test.js`
8. `run_assembler` + DB-mode dosya kontrolleri + runtime smoke

## 6. Sonuç Kriterleri

- **PASS:** tüm uygulanabilir test adımları başarılı.
- **BLOCKED:** implementasyon eksikliği veya dış bağımlılık nedeni ile tamamlanamayan adım.
- **FAIL:** implementasyon var fakat test başarısız.

## 7. Defect ve Retest Süreci

- Defect kaydı için: `docs/sprint3_te_defect_log.md`
- Her başarısız adım için:
  - komut,
  - beklenen/gerçekleşen sonuç,
  - log/screenshot,
  - severity,
  - retest tarihi eklenmeli.
