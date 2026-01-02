/**
 * Repository Interface
 * Defines the contract for data access layers.
 */
class RepositoryInterface {
  /**
   * Find all entities matching the filter.
   * @param {string} entitySlug 
   * @param {object} filter - Key-value pairs to filter by (exact match)
   */
  async findAll(entitySlug, filter) { throw new Error('Not implemented'); }
  
  async findById(entitySlug, id) { throw new Error('Not implemented'); }
  async create(entitySlug, data) { throw new Error('Not implemented'); }
  async update(entitySlug, id, data) { throw new Error('Not implemented'); }
  async delete(entitySlug, id) { throw new Error('Not implemented'); }
}

module.exports = RepositoryInterface;
