/**
 * Repository Interface
 * Defines the contract for data access layers.
 */
class RepositoryInterface {
  async findAll(entitySlug) { throw new Error('Not implemented'); }
  async findById(entitySlug, id) { throw new Error('Not implemented'); }
  async create(entitySlug, data) { throw new Error('Not implemented'); }
  async update(entitySlug, id, data) { throw new Error('Not implemented'); }
  async delete(entitySlug, id) { throw new Error('Not implemented'); }
}

module.exports = RepositoryInterface;
