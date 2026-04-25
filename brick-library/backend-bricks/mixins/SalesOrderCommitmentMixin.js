/**
 * SalesOrderCommitmentMixin
 *
 * Keeps `products.committed_quantity` in sync with the backlog of approved
 * sales orders (ordered_qty minus shipped_qty summed across lines), and
 * realizes stock movements when a sales order is shipped.
 *
 * This mixin is attached to TWO services:
 *   - `sales_order_lines` service with role='lines' — reacts to line CRUD.
 *   - `sales_orders` service      with role='header' — reacts to status
 *     transitions (draft → approved, approved → shipped / cancelled / closed).
 *
 * The math lives in `PostgresProvider.atomicAdjustCommitted`, which also
 * recomputes `available_quantity` atomically.
 *
 * Usage (assembler-side registration):
 *   mixins: [
 *     { name: 'SalesOrderCommitmentMixin',
 *       config: { role: 'lines', stock_entity: 'products', ... } },
 *   ]
 */
module.exports = (config = {}) => {
  const defaults = {
    role: 'lines',
    header_entity: 'sales_orders',
    line_entity: 'sales_order_lines',
    stock_entity: 'products',
    stock_movement_entity: 'stock_movements',
    parent_field: 'sales_order',
    product_field: 'product',
    ordered_field: 'ordered_qty',
    shipped_field: 'shipped_qty',
    unit_price_field: 'unit_price',
    line_total_field: 'line_total',
    status_field: 'status',
    stock_quantity_field: 'quantity',
    stock_reserved_field: 'reserved_quantity',
    stock_committed_field: 'committed_quantity',
    stock_available_field: 'available_quantity',
    movement_type_field: 'movement_type',
    movement_qty_field: 'quantity',
    movement_product_field: 'product',
    movement_reference_field: 'reference',
    allow_negative_stock: false,
  };
  const c = { ...defaults, ...(config && typeof config === 'object' ? config : {}) };

  const role = String(c.role || 'lines').toLowerCase();

  // Config literal inlined into hook bodies (they're stringified and then
  // pasted into the generated service file at assemble-time).
  const CFG = JSON.stringify(c);

  if (role === 'header') {
    return {
      dependencies: [],
      hooks: {
        BEFORE_UPDATE_VALIDATION: `
          const __CFG = ${CFG};
          const __prev = await this.repository.findById(this.slug, id);
          this._soHeaderPrevStatus = __prev ? String(__prev[__CFG.status_field] || '').toLowerCase() : null;
        `,
        AFTER_UPDATE_LOGGING: `
          const __CFG = ${CFG};
          const __prevStatus = this._soHeaderPrevStatus;
          const __nextStatus = data && data[__CFG.status_field] !== undefined
            ? String(data[__CFG.status_field] || '').toLowerCase()
            : null;
          if (__prevStatus && __nextStatus && __prevStatus !== __nextStatus) {
            await this._applySalesOrderStatusTransition(result?.id ?? id, __prevStatus, __nextStatus);
          }
        `,
      },
      methods: `
  _soHeaderCfg() { return ${CFG}; }

  /**
   * Admin / data-fix helper: recompute committed_quantity on every product
   * from scratch by summing (ordered_qty - shipped_qty) across every
   * sales_order_line whose parent sales_order is in status 'approved'.
   *
   * Returns a summary { products_updated, total_committed }.
   */
  async recomputeCommitted() {
    const CFG = this._soHeaderCfg();
    const approvedOrders = await this.repository.findAll(CFG.header_entity, { [CFG.status_field]: 'approved' });
    const approvedIds = new Set((approvedOrders || []).map((o) => String(o && o.id)));

    const totals = new Map();
    if (approvedIds.size > 0) {
      const lines = await this.repository.findAll(CFG.line_entity, {});
      for (const line of (lines || [])) {
        if (!line || !approvedIds.has(String(line[CFG.parent_field]))) continue;
        const productId = line[CFG.product_field];
        if (!productId) continue;
        const ordered = Number(line[CFG.ordered_field]) || 0;
        const shipped = Number(line[CFG.shipped_field]) || 0;
        const remaining = ordered - shipped;
        if (remaining <= 0) continue;
        const key = String(productId);
        totals.set(key, (totals.get(key) || 0) + remaining);
      }
    }

    const products = await this.repository.findAll(CFG.stock_entity, {});
    let updated = 0;
    let grandTotal = 0;
    for (const product of (products || [])) {
      if (!product || !product.id) continue;
      const target = totals.get(String(product.id)) || 0;
      const current = Number(product[CFG.stock_committed_field]) || 0;
      const delta = target - current;
      if (delta === 0) continue;
      await this.repository.atomicAdjustCommitted(CFG.stock_entity, product.id, {
        quantityField: CFG.stock_quantity_field,
        reservedField: CFG.stock_reserved_field,
        committedField: CFG.stock_committed_field,
        availableField: CFG.stock_available_field,
        committedDelta: delta,
        allow_negative_stock: true,
      });
      updated += 1;
      grandTotal += target;
    }

    return {
      products_updated: updated,
      total_committed: grandTotal,
    };
  }

  async _applySalesOrderStatusTransition(orderId, prevStatus, nextStatus) {
    const CFG = this._soHeaderCfg();
    const lines = await this.repository.findAll(CFG.line_entity, { [CFG.parent_field]: orderId });
    if (!Array.isArray(lines) || lines.length === 0) return;

    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const ADD_COMMITTED = (prevStatus === 'draft' && nextStatus === 'approved');
    const SHIP          = (prevStatus === 'approved' && nextStatus === 'shipped');
    const CANCEL_CLOSE  = (prevStatus === 'approved' && (nextStatus === 'cancelled' || nextStatus === 'closed'));

    if (!ADD_COMMITTED && !SHIP && !CANCEL_CLOSE) return;

    for (const line of lines) {
      const productId = line[CFG.product_field];
      if (!productId) continue;

      const ordered = toNum(line[CFG.ordered_field]);
      const shipped = toNum(line[CFG.shipped_field]);
      const remaining = ordered - shipped;
      if (remaining <= 0 && !SHIP) continue;

      if (ADD_COMMITTED) {
        await this.repository.atomicAdjustCommitted(CFG.stock_entity, productId, {
          quantityField: CFG.stock_quantity_field,
          reservedField: CFG.stock_reserved_field,
          committedField: CFG.stock_committed_field,
          availableField: CFG.stock_available_field,
          committedDelta: remaining,
          allow_negative_stock: CFG.allow_negative_stock === true,
        });
        continue;
      }

      if (CANCEL_CLOSE) {
        if (remaining > 0) {
          await this.repository.atomicAdjustCommitted(CFG.stock_entity, productId, {
            quantityField: CFG.stock_quantity_field,
            reservedField: CFG.stock_reserved_field,
            committedField: CFG.stock_committed_field,
            availableField: CFG.stock_available_field,
            committedDelta: -remaining,
            allow_negative_stock: true,
          });
        }
        continue;
      }

      if (SHIP) {
        if (remaining > 0) {
          await this.repository.atomicAdjustCommitted(CFG.stock_entity, productId, {
            quantityField: CFG.stock_quantity_field,
            reservedField: CFG.stock_reserved_field,
            committedField: CFG.stock_committed_field,
            availableField: CFG.stock_available_field,
            quantityDelta: -remaining,
            committedDelta: -remaining,
            allow_negative_stock: CFG.allow_negative_stock === true,
          });

          await this.repository.update(CFG.line_entity, line.id, {
            [CFG.shipped_field]: ordered,
          });

          try {
            await this.repository.create(CFG.stock_movement_entity, {
              [CFG.movement_type_field]: 'issue',
              [CFG.movement_product_field]: productId,
              [CFG.movement_qty_field]: remaining,
              [CFG.movement_reference_field]: 'sales_order:' + String(orderId),
            });
          } catch (movementErr) {
            // stock_movements is optional; ignore if the entity does not exist.
          }
        }
      }
    }
  }
      `,
    };
  }

  // role === 'lines'
  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_TRANSFORMATION: `
        const __CFG = ${CFG};
        const __ordered = Number(data[__CFG.ordered_field]);
        const __price = Number(data[__CFG.unit_price_field]);
        if (!Number.isFinite(__ordered) || __ordered < 0) {
          throw new Error(__CFG.ordered_field + ' must be >= 0');
        }
        if (data[__CFG.shipped_field] === undefined || data[__CFG.shipped_field] === null) {
          data[__CFG.shipped_field] = 0;
        }
        if (Number.isFinite(__price)) {
          data[__CFG.line_total_field] = Number((__ordered * __price).toFixed(2));
        } else {
          data[__CFG.line_total_field] = 0;
        }
      `,
      AFTER_CREATE_LOGGING: `
        const __CFG = ${CFG};
        const __orderId = result?.[__CFG.parent_field];
        const __productId = result?.[__CFG.product_field];
        if (!__orderId || !__productId) return;
        const __parent = await this.repository.findById(__CFG.header_entity, __orderId);
        const __status = __parent ? String(__parent[__CFG.status_field] || '').toLowerCase() : null;
        if (__status !== 'approved') return;
        const __ordered = Number(result[__CFG.ordered_field]) || 0;
        const __shipped = Number(result[__CFG.shipped_field]) || 0;
        const __delta = __ordered - __shipped;
        if (__delta !== 0) {
          await this.repository.atomicAdjustCommitted(__CFG.stock_entity, __productId, {
            quantityField: __CFG.stock_quantity_field,
            reservedField: __CFG.stock_reserved_field,
            committedField: __CFG.stock_committed_field,
            availableField: __CFG.stock_available_field,
            committedDelta: __delta,
            allow_negative_stock: __CFG.allow_negative_stock === true,
          });
        }
      `,
      BEFORE_UPDATE_VALIDATION: `
        const __CFG = ${CFG};
        const __existing = await this.repository.findById(this.slug, id);
        this._soLinePrev = __existing
          ? {
              product: __existing[__CFG.product_field],
              ordered: Number(__existing[__CFG.ordered_field]) || 0,
              shipped: Number(__existing[__CFG.shipped_field]) || 0,
              parent: __existing[__CFG.parent_field],
            }
          : null;
        if (data[__CFG.ordered_field] !== undefined || data[__CFG.unit_price_field] !== undefined) {
          const __ord = Number(data[__CFG.ordered_field] ?? __existing?.[__CFG.ordered_field] ?? 0);
          const __pr = Number(data[__CFG.unit_price_field] ?? __existing?.[__CFG.unit_price_field] ?? 0);
          if (Number.isFinite(__ord) && Number.isFinite(__pr)) {
            data[__CFG.line_total_field] = Number((__ord * __pr).toFixed(2));
          }
        }
      `,
      AFTER_UPDATE_LOGGING: `
        const __CFG = ${CFG};
        const __prev = this._soLinePrev;
        if (!__prev || !__prev.parent || !__prev.product) return;
        const __parent = await this.repository.findById(__CFG.header_entity, __prev.parent);
        const __status = __parent ? String(__parent[__CFG.status_field] || '').toLowerCase() : null;
        if (__status !== 'approved') return;
        const __newOrdered = Number(result?.[__CFG.ordered_field] ?? __prev.ordered) || 0;
        const __newShipped = Number(result?.[__CFG.shipped_field] ?? __prev.shipped) || 0;
        const __oldRemaining = __prev.ordered - __prev.shipped;
        const __newRemaining = __newOrdered - __newShipped;
        const __committedDelta = __newRemaining - __oldRemaining;
        const __shippedIncrease = Math.max(0, __newShipped - __prev.shipped);

        if (__committedDelta !== 0) {
          await this.repository.atomicAdjustCommitted(__CFG.stock_entity, __prev.product, {
            quantityField: __CFG.stock_quantity_field,
            reservedField: __CFG.stock_reserved_field,
            committedField: __CFG.stock_committed_field,
            availableField: __CFG.stock_available_field,
            committedDelta: __committedDelta,
            allow_negative_stock: true,
          });
        }
        if (__shippedIncrease > 0) {
          await this.repository.atomicAdjustCommitted(__CFG.stock_entity, __prev.product, {
            quantityField: __CFG.stock_quantity_field,
            reservedField: __CFG.stock_reserved_field,
            committedField: __CFG.stock_committed_field,
            availableField: __CFG.stock_available_field,
            quantityDelta: -__shippedIncrease,
            committedDelta: -__shippedIncrease,
            allow_negative_stock: __CFG.allow_negative_stock === true,
          });
          try {
            await this.repository.create(__CFG.stock_movement_entity, {
              [__CFG.movement_type_field]: 'issue',
              [__CFG.movement_product_field]: __prev.product,
              [__CFG.movement_qty_field]: __shippedIncrease,
              [__CFG.movement_reference_field]: 'sales_order:' + String(__prev.parent),
            });
          } catch (movementErr) {
            // stock_movements is optional; ignore if the entity does not exist.
          }
        }
      `,
      BEFORE_DELETE_VALIDATION: `
        const __CFG = ${CFG};
        const __existing = await this.repository.findById(this.slug, id);
        this._soLineDeletePrev = __existing
          ? {
              product: __existing[__CFG.product_field],
              ordered: Number(__existing[__CFG.ordered_field]) || 0,
              shipped: Number(__existing[__CFG.shipped_field]) || 0,
              parent: __existing[__CFG.parent_field],
            }
          : null;
      `,
      AFTER_DELETE_LOGGING: `
        const __CFG = ${CFG};
        const __prev = this._soLineDeletePrev;
        if (!__prev || !__prev.parent || !__prev.product) return;
        const __parent = await this.repository.findById(__CFG.header_entity, __prev.parent);
        const __status = __parent ? String(__parent[__CFG.status_field] || '').toLowerCase() : null;
        if (__status !== 'approved') return;
        const __remaining = __prev.ordered - __prev.shipped;
        if (__remaining > 0) {
          await this.repository.atomicAdjustCommitted(__CFG.stock_entity, __prev.product, {
            quantityField: __CFG.stock_quantity_field,
            reservedField: __CFG.stock_reserved_field,
            committedField: __CFG.stock_committed_field,
            availableField: __CFG.stock_available_field,
            committedDelta: -__remaining,
            allow_negative_stock: true,
          });
        }
      `,
    },
    methods: ``,
  };
};
