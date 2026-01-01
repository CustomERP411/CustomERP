/**
 * BaseController - Generic CRUD Controller Brick
 * 
 * This brick provides a reusable base controller with standard CRUD operations.
 * It can be extended or composed with other logic bricks via the Assembler.
 * 
 * Usage:
 *   const controller = new BaseController(repository, 'product');
 *   router.get('/', (req, res) => controller.getAll(req, res));
 */

class BaseController {
  /**
   * @param {Object} repository - Repository instance implementing RepositoryInterface
   * @param {string} entitySlug - The entity slug (e.g., 'product', 'category')
   */
  constructor(repository, entitySlug) {
    this.repository = repository;
    this.entitySlug = entitySlug;
  }

  /**
   * GET / - Retrieve all records
   */
  async getAll(req, res) {
    try {
      const items = await this.repository.findAll(this.entitySlug);
      res.json(items);
    } catch (error) {
      console.error(`[${this.entitySlug}] getAll error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /:id - Retrieve a single record by ID
   */
  async getById(req, res) {
    try {
      const item = await this.repository.findById(this.entitySlug, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    } catch (error) {
      console.error(`[${this.entitySlug}] getById error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST / - Create a new record
   */
  async create(req, res) {
    try {
      const item = await this.repository.create(this.entitySlug, req.body);
      res.status(201).json(item);
    } catch (error) {
      console.error(`[${this.entitySlug}] create error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /:id - Update an existing record
   */
  async update(req, res) {
    try {
      const item = await this.repository.update(this.entitySlug, req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    } catch (error) {
      console.error(`[${this.entitySlug}] update error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /:id - Delete a record
   */
  async delete(req, res) {
    try {
      const deleted = await this.repository.delete(this.entitySlug, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error(`[${this.entitySlug}] delete error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Bind all methods to this instance (useful for Express routing)
   * @returns {Object} Object with bound methods
   */
  bindMethods() {
    return {
      getAll: this.getAll.bind(this),
      getById: this.getById.bind(this),
      create: this.create.bind(this),
      update: this.update.bind(this),
      delete: this.delete.bind(this),
    };
  }
}

module.exports = BaseController;

