var _ = require('underscore');
var $ = require('jquery');
var Backbone = require('backbone');
var util = require('../core/util');

var CartoDBLayerGroup = Backbone.Model.extend({
  defaults: {
    visible: true,
    type: 'layergroup'
  },

  initialize: function (attributes, options) {
    options = options || {};

    if (!options.layersCollection) {
      throw new Error('layersCollection option is required');
    }
    this._layersCollection = options.layersCollection;
  },

  forEachGroupedLayer: function (iteratee, context) {
    _.each(this._getGroupedLayers(), iteratee.bind(context || this));
  },

  _getGroupedLayers: function () {
    return this._layersCollection.getCartoDBLayers();
  },

  _getLayers: function () {
    return this._layersCollection.models;
  },

  getIndexOfLayerInLayerGroup: function (layerModel) {
    return this._getGroupedLayers().indexOf(layerModel);
  },

  getLayerInLayerGroupAt: function (index) {
    return this._getGroupedLayers()[index];
  },

  isEqual: function () {
    return false;
  },

  hasURLs: function () {
    return !!this.get('urls');
  },

  getTileURLTemplates: function (type) {
    type = type || 'png';

    var tileURLTemplates = (this.get('urls') && this.get('urls').tiles) || [];
    if (type === 'png') {
      if (this._areAllLayersHidden()) {
        return [];
      }
      return _.map(tileURLTemplates, this._generatePNGTileURLTemplate.bind(this));
    } else if (type === 'mvt') {
      return this._generateMTVTileURLTemplate(tileURLTemplates[0]);
    }
  },

  _generatePNGTileURLTemplate: function (urlTemplate) {
    urlTemplate = urlTemplate
      .replace('{layerIndexes}', this._getIndexesOfVisibleMapnikLayers())
      .replace('{format}', 'png');
    return this._appendAuthParamsToURL(urlTemplate);
  },

  _generateMTVTileURLTemplate: function (urlTemplate) {
    urlTemplate = urlTemplate
      .replace('{layerIndexes}', 'mapnik')
      .replace('{format}', 'mvt');
    return this._appendAuthParamsToURL(urlTemplate);
  },

  _areAllLayersHidden: function () {
    return _.all(this._getGroupedLayers(), function (layerModel) {
      return !layerModel.isVisible();
    });
  },

  _getIndexesOfVisibleMapnikLayers: function (url) {
    var indexOfLayersInWindshaft = this.get('indexOfLayersInWindshaft');
    return _.reduce(this._getGroupedLayers(), function (indexes, layerModel, layerIndex) {
      if (layerModel.isVisible()) {
        indexes.push(indexOfLayersInWindshaft[layerIndex]);
      }
      return indexes;
    }, []).join(',');
  },

  _getIndexesOfVisibleLayers: function (url) {
    return _.reduce(this._getLayers(), function (indexes, layerModel, layerIndex) {
      if (layerModel.isVisible()) {
        indexes.push(layerIndex);
      }
      return indexes;
    }, []).join(',');
  },

  hasTileURLTemplates: function () {
    return this.getTileURLTemplates().length > 0;
  },

  getGridURLTemplates: function (layerIndex) {
    var gridURLTemplates = (this.get('urls') && this.get('urls').grids && this.get('urls').grids[layerIndex]) || [];
    return _.map(gridURLTemplates, this._appendAuthParamsToURL, this);
  },

  getAttributesBaseURL: function (layerIndex) {
    return this.get('urls') && this.get('urls').attributes && this.get('urls').attributes[layerIndex];
  },

  getStaticImageURLTemplate: function () {
    var staticImageURLTemplate = this.get('urls') && this.get('urls').image;
    if (staticImageURLTemplate) {
      staticImageURLTemplate = this._appendParamsToURL(staticImageURLTemplate, [ 'layer=' + this._getIndexesOfVisibleLayers() ]);
      staticImageURLTemplate = this._appendAuthParamsToURL(staticImageURLTemplate);
    }
    return staticImageURLTemplate;
  },

  fetchAttributes: function (layerIndex, featureID, callback) {
    var attributeBaseURL = this.getAttributesBaseURL(layerIndex);
    if (!attributeBaseURL) {
      throw new Error('Attributes cannot be fetched until urls are set');
    }

    var url = this._appendAuthParamsToURL(attributeBaseURL + '/' + featureID);

    $.ajax({
      dataType: 'jsonp',
      url: url,
      jsonpCallback: '_cdbi_layer_attributes_' + util.uniqueCallbackName(this.toJSON()),
      cache: true,
      success: function (data) {
        // loadingTime.end();
        callback(data);
      },
      error: function (data) {
        // loadingTime.end();
        // cartodb.core.Profiler.metric('cartodb-js.named_map.attributes.error').inc();
        callback(null);
      }
    });
  },

  _appendAuthParamsToURL: function (url) {
    var params = [];
    if (this.get('apiKey')) {
      params.push('api_key=' + this.get('apiKey'));
    } else if (this.get('authToken')) {
      var authToken = this.get('authToken');
      if (authToken instanceof Array) {
        _.each(authToken, function (token) {
          params.push('auth_token[]=' + token);
        });
      } else {
        params.push('auth_token=' + authToken);
      }
    }

    return this._appendParamsToURL(url, params);
  },

  _appendParamsToURL: function (url, params) {
    if (params.length) {
      var separator = '?';
      if (url.indexOf('?') !== -1) {
        separator = '&';
      }
      return url + separator + params.join('&');
    }
    return url;
  },

  onLayerVisibilityChanged: function (callback) {
    this._layersCollection.on('change:visible', function (layerModel) {
      if (this._isLayerGrouped(layerModel)) {
        callback(layerModel);
      }
    }, this);
  },

  onLayerAdded: function (callback) {
    this._layersCollection.on('add', function (layerModel) {
      if (this._isLayerGrouped(layerModel)) {
        callback(layerModel, this.getLayerInLayerGroupAt(layerModel));
      }
    }, this);
  },

  _isLayerGrouped: function (layerModel) {
    return this._getGroupedLayers().indexOf(layerModel) >= 0;
  }
});

module.exports = CartoDBLayerGroup;
