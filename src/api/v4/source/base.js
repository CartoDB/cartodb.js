const _ = require('underscore');
const Backbone = require('backbone');
const CartoError = require('../error-handling/carto-error');
const { FiltersCollection } = require('../../../filters/filters-collection');
const EVENTS = require('../events');

/**
 * Base data source object.
 *
 * The methods listed in the {@link carto.source.Base|source.Base} object are available in all source objects.
 *
 * Use a source to reference the data used in a {@link carto.dataview.Base|dataview} or a {@link carto.layer.Base|layer}.
 *
 * {@link carto.source.Base} should not be used directly use {@link carto.source.Dataset} or {@link carto.source.SQL} instead.
 *
 * @constructor
 * @fires error
 * @abstract
 * @memberof carto.source
 * @api
 */
function Base () {
  this._id = Base.$generateId();
  this._hasFiltersApplied = false;
  this._appliedFilters = new FiltersCollection();
}

_.extend(Base.prototype, Backbone.Events);

/**
 * The instance id will be autogenerated by incrementing this variable.
 */
Base.$nextId = 0;

/**
 * Static funciton used internally to autogenerate source ids.
 */
Base.$generateId = function () {
  return 'S' + ++Base.$nextId;
};

/**
 * Return a unique autogenerated id.
 *
 * @return {string} Unique autogenerated id
 */
Base.prototype.getId = function () {
  return this._id;
};

Base.prototype._createInternalModel = function (engine) {
  throw new Error('_createInternalModel must be implemented by the particular source');
};

/**
 * Fire a CartoError event from a internalError
 */
Base.prototype._triggerError = function (model, internalError) {
  this.trigger(EVENTS.ERROR, new CartoError(internalError, { analysis: this }));
};

Base.prototype.$setEngine = function (engine) {
  if (!this._internalModel) {
    this._internalModel = this._createInternalModel(engine);
    this._internalModel.on('change:error', this._triggerError, this);
  }
};

/**
 * Return the engine form the source internal model
 */
Base.prototype.$getEngine = function (engine) {
  if (this._internalModel) {
    return this._internalModel._engine;
  }
};

/**
 * Return the real CARTO.js model used by the source.
 */
Base.prototype.$getInternalModel = function () {
  return this._internalModel;
};

Base.prototype.addFilter = function (filter) {
  this._appliedFilters.add(filter);
  this._hasFiltersApplied = true;
};

Base.prototype.addFilters = function (filters) {
  filters.forEach(filter => this.addFilter(filter));
};

Base.prototype.removeFilter = function (filter) {
  this._appliedFilters.remove(filter);
  this._hasFiltersApplied = Boolean(this._appliedFilters.count());
};

Base.prototype.removeFilters = function (filters) {
  filters.forEach(filter => this.removeFilter(filter));
};

module.exports = Base;
