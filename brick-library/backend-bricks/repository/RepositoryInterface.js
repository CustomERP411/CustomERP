/**
 * RepositoryInterface - Data Access Layer Contract
 * 
 * This interface defines the contract that all repository implementations must follow.
 * It enables the platform to swap data providers (flat-file, PostgreSQL, etc.)
 * without changing business logic.
 * 
 * Implementations:
 *   - FlatFileProvider.js (Increment 1)
 *   - PostgreSQLProvider.js (Increment 2+)
 */

class RepositoryInterface {
  /**
   * Retrieve all records for an entity
   * @param {string} entitySlug - The entity type (e.g., 'product')
   * @returns {Promise<Array>} Array of records
   */
  async findAll(entitySlug) {
    throw new Error('Method findAll() must be implemented');
  }

  /**
   * Find a single record by ID
   * @param {string} entitySlug - The entity type
   * @param {string} id - The record ID
   * @returns {Promise<Object|null>} The record or null if not found
   */
  async findById(entitySlug, id) {
    throw new Error('Method findById() must be implemented');
  }

  /**
   * Find records matching a query
   * @param {string} entitySlug - The entity type
   * @param {Object} query - Query conditions (e.g., { category: 'electronics' })
   * @returns {Promise<Array>} Array of matching records
   */
  async findWhere(entitySlug, query) {
    throw new Error('Method findWhere() must be implemented');
  }

  /**
   * Create a new record
   * @param {string} entitySlug - The entity type
   * @param {Object} data - The record data
   * @returns {Promise<Object>} The created record with generated ID
   */
  async create(entitySlug, data) {
    throw new Error('Method create() must be implemented');
  }

  /**
   * Update an existing record
   * @param {string} entitySlug - The entity type
   * @param {string} id - The record ID
   * @param {Object} data - The updated data
   * @returns {Promise<Object|null>} The updated record or null if not found
   */
  async update(entitySlug, id, data) {
    throw new Error('Method update() must be implemented');
  }

  /**
   * Delete a record
   * @param {string} entitySlug - The entity type
   * @param {string} id - The record ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(entitySlug, id) {
    throw new Error('Method delete() must be implemented');
  }

  /**
   * Count records for an entity
   * @param {string} entitySlug - The entity type
   * @param {Object} query - Optional query conditions
   * @returns {Promise<number>} Count of records
   */
  async count(entitySlug, query = {}) {
    throw new Error('Method count() must be implemented');
  }

  /**
   * Check if a record exists
   * @param {string} entitySlug - The entity type
   * @param {string} id - The record ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(entitySlug, id) {
    const item = await this.findById(entitySlug, id);
    return item !== null;
  }
}

module.exports = RepositoryInterface;

