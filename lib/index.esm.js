import defu from 'defu';
import * as fs from 'fs';
import { mkdirSync, writeFileSync, existsSync, writeFile } from 'fs';
import * as path from 'pathe';
import path__default, { resolve, basename, parse, join, dirname } from 'pathe';
import MagicString from 'magic-string';
import { createFilter } from '@rollup/pluginutils';
import { walk } from 'estree-walker';
import { normalizeOptions } from '@module-federation/sdk';
import { normalizeGenerateTypesOptions, generateTypesAPI, normalizeDtsOptions, normalizeConsumeTypesOptions, consumeTypesAPI, isTSProject } from '@module-federation/dts-plugin';
import { rpc } from '@module-federation/dts-plugin/core';
import { fileURLToPath } from 'url';

var mapCodeToCodeWithSourcemap = function mapCodeToCodeWithSourcemap(code) {
  return Promise.resolve(code).then(function (resolvedCode) {
    if (resolvedCode === undefined) {
      return;
    }
    var s = new MagicString(resolvedCode);
    return {
      code: s.toString(),
      map: s.generateMap({
        hires: true
      })
    };
  });
};

function getFirstHtmlEntryFile(entryFiles) {
  return entryFiles.find(function (file) {
    return file.endsWith('.html');
  });
}
var addEntry = function addEntry(_ref) {
  var entryName = _ref.entryName,
    entryPath = _ref.entryPath,
    fileName = _ref.fileName,
    _ref$inject = _ref.inject,
    inject = _ref$inject === void 0 ? 'entry' : _ref$inject;
  var devEntryPath = entryPath.startsWith('virtual:mf') ? '@id/' + entryPath : entryPath;
  var entryFiles = [];
  var htmlFilePath;
  var _command;
  var emitFileId;
  var viteConfig;
  function injectHtml() {
    return inject === 'html' && htmlFilePath;
  }
  function injectEntry() {
    return inject === 'entry' || !htmlFilePath;
  }
  return [{
    name: 'add-entry',
    apply: 'serve',
    config: function config(_config, _ref2) {
      var command = _ref2.command;
      _command = command;
    },
    configResolved: function configResolved(config) {
      viteConfig = config;
      devEntryPath = config.base + devEntryPath.replace(/\\\\?/g, '/').replace(/.+?\:([/\\])[/\\]?/, '$1').replace(/^\//, '');
    },
    configureServer: function configureServer(server) {
      server.middlewares.use(function (req, res, next) {
        if (!fileName) {
          next();
          return;
        }
        if (req.url && req.url.startsWith((viteConfig.base + fileName).replace(/^\/?/, '/'))) {
          req.url = devEntryPath;
        }
        next();
      });
    },
    transformIndexHtml: function transformIndexHtml(c) {
      if (!injectHtml()) return;
      return c.replace('<head>', "<head><script type=\"module\" src=" + JSON.stringify(devEntryPath.replace(/.+?\:([/\\])[/\\]?/, '$1').replace(/\\\\?/g, '/')) + "></script>");
    },
    transform: function transform(code, id) {
      if (id.includes('node_modules') || inject !== 'html' || htmlFilePath) {
        return;
      }
      if (id.includes('.svelte-kit') && id.includes('internal.js')) {
        var src = devEntryPath.replace(/.+?\:([/\\])[/\\]?/, '$1').replace(/\\\\?/g, '/');
        return code.replace(/<head>/g, '<head><script type=\\"module\\" src=\\"' + src + '\\"></script>');
      }
    }
  }, {
    name: 'add-entry',
    enforce: 'post',
    configResolved: function configResolved(config) {
      viteConfig = config;
      var inputOptions = config.build.rollupOptions.input;
      if (!inputOptions) {
        htmlFilePath = path.resolve(config.root, 'index.html');
      } else if (typeof inputOptions === 'string') {
        entryFiles = [inputOptions];
      } else if (Array.isArray(inputOptions)) {
        entryFiles = inputOptions;
      } else if (typeof inputOptions === 'object') {
        entryFiles = Object.values(inputOptions);
      }
      if (entryFiles && entryFiles.length > 0) {
        htmlFilePath = getFirstHtmlEntryFile(entryFiles);
      }
    },
    buildStart: function buildStart() {
      if (_command === 'serve') return;
      var hasHash = fileName == null || fileName.includes == null ? void 0 : fileName.includes('[hash');
      var emitFileOptions = {
        name: entryName,
        type: 'chunk',
        id: entryPath,
        preserveSignature: 'strict'
      };
      if (!hasHash) {
        emitFileOptions.fileName = fileName;
      }
      emitFileId = this.emitFile(emitFileOptions);
      if (htmlFilePath && fs.existsSync(htmlFilePath)) {
        var htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');
        var scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
        var match;
        while ((match = scriptRegex.exec(htmlContent)) !== null) {
          entryFiles.push(match[1]);
        }
      }
    },
    generateBundle: function generateBundle(options, bundle) {
      if (!injectHtml()) return;
      var file = this.getFileName(emitFileId);
      // Helper to resolve path with proper renderBuiltUrl handling
      var resolvePath = function resolvePath(htmlFileName) {
        var _viteConfig$experimen;
        if (!((_viteConfig$experimen = viteConfig.experimental) != null && _viteConfig$experimen.renderBuiltUrl)) {
          return viteConfig.base + file;
        }
        var result = viteConfig.experimental.renderBuiltUrl(file, {
          hostId: htmlFileName,
          hostType: 'html',
          type: 'asset',
          ssr: false
        });
        // Handle return types
        if (typeof result === 'string') {
          return result;
        }
        if (result && typeof result === 'object') {
          if ('runtime' in result) {
            // Runtime code cannot be used in <script src="">
            console.warn('[vite-plugin-federation] renderBuiltUrl returned runtime code for HTML injection. ' + 'Runtime code cannot be used in <script src="">. Falling back to base path.');
            return viteConfig.base + file;
          }
          if (result.relative) {
            return file;
          }
        }
        // Fallback for undefined or unexpected values
        return viteConfig.base + file;
      };
      // Process each HTML file
      for (var _fileName in bundle) {
        if (_fileName.endsWith('.html')) {
          var htmlAsset = bundle[_fileName];
          if (htmlAsset.type === 'chunk') return;
          var _path = resolvePath(_fileName);
          var scriptContent = "\n          <script type=\"module\" src=\"" + _path + "\"></script>\n        ";
          var htmlContent = htmlAsset.source.toString() || '';
          htmlContent = htmlContent.replace('<head>', "<head>" + scriptContent);
          htmlAsset.source = htmlContent;
        }
      }
    },
    transform: function transform(code, id) {
      if (injectEntry() && entryFiles.some(function (file) {
        return id.endsWith(file);
      })) {
        var injection = "\n          import " + JSON.stringify(entryPath) + ";\n          ";
        return mapCodeToCodeWithSourcemap(injection + code);
      }
    }
  }];
};

function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _createForOfIteratorHelperLoose(r, e) {
  var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (t) return (t = t.call(r)).next.bind(t);
  if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) {
    t && (r = t);
    var o = 0;
    return function () {
      return o >= r.length ? {
        done: !0
      } : {
        done: !1,
        value: r[o++]
      };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _extends() {
  return _extends = Object.assign ? Object.assign.bind() : function (n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
    }
    return n;
  }, _extends.apply(null, arguments);
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}

/**
 * Check if user-defined alias conflicts with shared modules
 * This should run after aliasToArrayPlugin to ensure alias is an array
 */
function checkAliasConflicts(options) {
  var _options$shared = options.shared,
    shared = _options$shared === void 0 ? {} : _options$shared;
  var sharedKeys = Object.keys(shared);
  return {
    name: 'check-alias-conflicts',
    configResolved: function configResolved(config) {
      var _config$resolve;
      if (sharedKeys.length === 0) return;
      var userAliases = ((_config$resolve = config.resolve) == null ? void 0 : _config$resolve.alias) || [];
      var conflicts = [];
      for (var _i = 0, _sharedKeys = sharedKeys; _i < _sharedKeys.length; _i++) {
        var sharedKey = _sharedKeys[_i];
        for (var _iterator = _createForOfIteratorHelperLoose(userAliases), _step; !(_step = _iterator()).done;) {
          var aliasEntry = _step.value;
          var findPattern = aliasEntry.find;
          var replacement = aliasEntry.replacement;
          // Skip if replacement is not a string (e.g., customResolver)
          if (typeof replacement !== 'string') continue;
          // Skip Module Federation internal aliases (used for proxying shared modules)
          // These are generated with replacement '$1' and should not trigger warnings
          if (replacement === '$1') continue;
          // Check if alias pattern matches the shared module
          var isMatch = false;
          if (typeof findPattern === 'string') {
            isMatch = findPattern === sharedKey || sharedKey.startsWith(findPattern + '/');
          } else if (findPattern instanceof RegExp) {
            isMatch = findPattern.test(sharedKey);
          }
          if (isMatch) {
            conflicts.push({
              sharedModule: sharedKey,
              alias: String(findPattern),
              target: replacement
            });
          }
        }
      }
      if (conflicts.length > 0) {
        config.logger.warn('\n[Module Federation] Detected alias conflicts with shared modules:');
        conflicts.forEach(function (_ref) {
          var sharedModule = _ref.sharedModule,
            alias = _ref.alias,
            target = _ref.target;
          config.logger.warn("  - Shared module \"" + sharedModule + "\" is aliased by \"" + alias + "\" to \"" + target + "\"");
        });
        config.logger.warn("  This may cause runtime errors as the shared module will bypass Module Federation's sharing mechanism.");
      }
    }
  };
}

/**
 * Solve the problem that dev mode dependency prebunding does not support top-level await syntax
 */
function PluginDevProxyModuleTopLevelAwait() {
  var filterFunction = createFilter();
  var processedFlag = '/* already-processed-by-dev-proxy-module-top-level-await */';
  return {
    name: 'dev-proxy-module-top-level-await',
    apply: 'serve',
    transform: function transform(code, id) {
      if (code.includes(processedFlag)) {
        return null;
      }
      if (!code.includes('/*mf top-level-await placeholder replacement mf*/')) {
        return null;
      }
      if (!filterFunction(id)) return null;
      var ast;
      try {
        ast = this.parse(code, {
          allowReturnOutsideFunction: true
        });
      } catch (e) {
        throw new Error(id + ": " + e);
      }
      var magicString = new MagicString(code);
      walk(ast, {
        enter: function enter(node) {
          if (node.type === 'ExportNamedDeclaration' && node.specifiers) {
            var exportSpecifiers = node.specifiers.map(function (specifier) {
              return specifier.exported.name;
            });
            var proxyStatements = exportSpecifiers.map(function (name) {
              return "\n              const __mfproxy__await" + name + " = await " + name + "();\n              const __mfproxy__" + name + " = () => __mfproxy__await" + name + ";\n            ";
            }).join('\n');
            var exportStatements = exportSpecifiers.map(function (name) {
              return "__mfproxy__" + name + " as " + name;
            }).join(', ');
            var start = node.start;
            var end = node.end;
            var replacement = proxyStatements + "\nexport { " + exportStatements + " };";
            magicString.overwrite(start, end, replacement);
          }
          if (node.type === 'ExportDefaultDeclaration') {
            var declaration = node.declaration;
            var _start = node.start;
            var _end = node.end;
            var proxyStatement;
            var exportStatement = 'default';
            if (declaration.type === 'Identifier') {
              // example: export default foo;
              proxyStatement = "\n                const __mfproxy__awaitdefault = await " + declaration.name + "();\n                const __mfproxy__default = __mfproxy__awaitdefault;\n              ";
            } else if (declaration.type === 'CallExpression' || declaration.type === 'FunctionDeclaration') {
              // example: export default someFunction();
              var declarationCode = code.slice(declaration.start, declaration.end);
              proxyStatement = "\n                const __mfproxy__awaitdefault = await (" + declarationCode + ");\n                const __mfproxy__default = __mfproxy__awaitdefault;\n              ";
            } else {
              // other
              proxyStatement = "\n                const __mfproxy__awaitdefault = await (" + code.slice(declaration.start, declaration.end) + ");\n                const __mfproxy__default = __mfproxy__awaitdefault;\n              ";
            }
            var _replacement = proxyStatement + "\nexport { __mfproxy__default as " + exportStatement + " };";
            magicString.overwrite(_start, _end, _replacement);
          }
        }
      });
      var transformedCode = magicString.toString();
      return {
        code: processedFlag + "\n" + transformedCode,
        map: magicString.generateMap({
          hires: true
        })
      };
    }
  };
}

function _catch(body, recover) {
  try {
    var result = body();
  } catch (e) {
    return recover(e);
  }
  if (result && result.then) {
    return result.then(void 0, recover);
  }
  return result;
}
var DEFAULT_DEV_OPTIONS = {
  disableLiveReload: true,
  disableHotTypesReload: false,
  disableDynamicRemoteTypeHints: false
};
var DYNAMIC_HINTS_PLUGIN = '@module-federation/dts-plugin/dynamic-remote-type-hints-plugin';
var getIPv4 = function getIPv4() {
  return process.env['FEDERATION_IPV4'] || '127.0.0.1';
};
var forkDevWorkerPath = function () {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require.resolve('@module-federation/dts-plugin/dist/fork-dev-worker.js');
}();
var DevWorker = /*#__PURE__*/function () {
  function DevWorker(options) {
    this.worker = rpc.createRpcWorker(forkDevWorkerPath, {}, undefined, false);
    this.worker.connect(options);
  }
  var _proto = DevWorker.prototype;
  _proto.update = function update() {
    var _this$worker$process;
    (_this$worker$process = this.worker.process) == null || _this$worker$process.send == null || _this$worker$process.send({
      type: rpc.RpcGMCallTypes.CALL,
      id: this.worker.id,
      args: [undefined, 'update']
    });
  };
  _proto.exit = function exit() {
    this.worker.terminate();
  };
  return DevWorker;
}();
var normalizeDevOptions = function normalizeDevOptions(dev) {
  if (dev === false) {
    return false;
  }
  if (dev === true || typeof dev === 'undefined') {
    return _extends({}, DEFAULT_DEV_OPTIONS);
  }
  return _extends({}, DEFAULT_DEV_OPTIONS, dev);
};
var buildDtsModuleFederationConfig = function buildDtsModuleFederationConfig(options) {
  var exposes = {};
  Object.entries(options.exposes).forEach(function (_ref) {
    var key = _ref[0],
      value = _ref[1];
    if (typeof value === 'string') {
      exposes[key] = value;
      return;
    }
    var importValue = Array.isArray(value["import"]) ? value["import"][0] : value["import"];
    if (importValue) {
      exposes[key] = importValue;
    }
  });
  var remotes = {};
  Object.entries(options.remotes).forEach(function (_ref2) {
    var _remote$entryGlobalNa, _remote$entryGlobalNa2;
    var key = _ref2[0],
      remote = _ref2[1];
    if (typeof remote === 'string') {
      remotes[key] = remote;
      return;
    }
    if (!remote.entry) {
      return;
    }
    var entryLooksLikeUrl = ((_remote$entryGlobalNa = remote.entryGlobalName) == null ? void 0 : _remote$entryGlobalNa.startsWith('http')) || ((_remote$entryGlobalNa2 = remote.entryGlobalName) == null ? void 0 : _remote$entryGlobalNa2.includes('.json'));
    var entryGlobalName = entryLooksLikeUrl ? remote.name || key : remote.entryGlobalName || remote.name || key;
    remotes[key] = entryGlobalName + "@" + remote.entry;
  });
  return _extends({}, options, {
    exposes: exposes,
    remotes: remotes
  });
};
var resolveOutputDir = function resolveOutputDir(config) {
  var outDir = config.build.outDir;
  if (path.isAbsolute(outDir)) {
    return path.relative(config.root, outDir);
  }
  return outDir;
};
var ensureRuntimePlugin = function ensureRuntimePlugin(options, pluginId) {
  var hasPlugin = options.runtimePlugins.some(function (plugin) {
    if (typeof plugin === 'string') {
      return plugin === pluginId;
    }
    return plugin[0] === pluginId;
  });
  if (!hasPlugin) {
    options.runtimePlugins.push(pluginId);
  }
};
var normalizeDevDtsOptions = function normalizeDevDtsOptions(dts, context) {
  var defaultGenerateTypes = {
    compileInChildProcess: true
  };
  var defaultConsumeTypes = {
    consumeAPITypes: true
  };
  return normalizeOptions(isTSProject(dts, context), {
    generateTypes: defaultGenerateTypes,
    consumeTypes: defaultConsumeTypes,
    extraOptions: {},
    displayErrorInTerminal: typeof dts === 'object' && dts ? dts.displayErrorInTerminal : undefined
  }, 'mfOptions.dts')(dts);
};
var logDtsError = function logDtsError(error, dtsOptions) {
  if (dtsOptions === false) {
    return;
  }
  if (typeof dtsOptions === 'object' && dtsOptions && dtsOptions.displayErrorInTerminal === false) {
    return;
  }
  console.error(error);
};
function pluginDts(options) {
  if (options.dts === false) {
    return [];
  }
  var dtsModuleFederationConfig = buildDtsModuleFederationConfig(options);
  var resolvedConfig;
  var devWorker;
  var normalizedDevOptions;
  var hasGeneratedBundle = false;
  var devPlugin = {
    name: 'module-federation-dts-dev',
    apply: 'serve',
    config: function config(_config) {
      normalizedDevOptions = normalizeDevOptions(options.dev);
      if (!normalizedDevOptions) {
        return;
      }
      if (normalizedDevOptions.disableDynamicRemoteTypeHints) {
        return;
      }
      ensureRuntimePlugin(options, DYNAMIC_HINTS_PLUGIN);
      var define = _config.define ? _extends({}, _config.define) : {};
      if (!('FEDERATION_IPV4' in define)) {
        define.FEDERATION_IPV4 = JSON.stringify(getIPv4());
      }
      _config.define = define;
    },
    configResolved: function configResolved(config) {
      resolvedConfig = config;
    },
    configureServer: function configureServer(server) {
      if (!normalizedDevOptions || !resolvedConfig) {
        return;
      }
      var devOptions = normalizedDevOptions;
      if (devOptions.disableDynamicRemoteTypeHints && devOptions.disableHotTypesReload && devOptions.disableLiveReload) {
        return;
      }
      if (!options.name) {
        throw new Error('name is required if you want to enable dev server!');
      }
      var outputDir = resolveOutputDir(resolvedConfig);
      var normalizedDtsOptions = normalizeDevDtsOptions(options.dts, resolvedConfig.root);
      if (typeof normalizedDtsOptions !== 'object') {
        return;
      }
      var normalizedGenerateTypes = normalizeOptions(Boolean(normalizedDtsOptions), {
        compileInChildProcess: true
      }, 'mfOptions.dts.generateTypes')(normalizedDtsOptions.generateTypes);
      var remote = normalizedGenerateTypes === false ? undefined : _extends({
        implementation: normalizedDtsOptions.implementation,
        context: resolvedConfig.root,
        outputDir: outputDir,
        moduleFederationConfig: _extends({}, dtsModuleFederationConfig),
        hostRemoteTypesFolder: normalizedGenerateTypes.typesFolder || '@mf-types'
      }, normalizedGenerateTypes, {
        typesFolder: '.dev-server'
      });
      if (remote && !remote.tsConfigPath && typeof normalizedDtsOptions === 'object' && normalizedDtsOptions.tsConfigPath) {
        remote.tsConfigPath = normalizedDtsOptions.tsConfigPath;
      }
      var normalizedConsumeTypes = normalizeOptions(Boolean(normalizedDtsOptions), {
        consumeAPITypes: true
      }, 'mfOptions.dts.consumeTypes')(normalizedDtsOptions.consumeTypes);
      var host = normalizedConsumeTypes === false ? undefined : _extends({
        implementation: normalizedDtsOptions.implementation,
        context: resolvedConfig.root,
        moduleFederationConfig: dtsModuleFederationConfig,
        typesFolder: normalizedConsumeTypes.typesFolder || '@mf-types',
        abortOnError: false
      }, normalizedConsumeTypes);
      var extraOptions = normalizedDtsOptions.extraOptions || {};
      if (!remote && !host && devOptions.disableLiveReload) {
        return;
      }
      var startDevWorker = function startDevWorker() {
        try {
          var _temp2 = function _temp2() {
            var _server$httpServer;
            devWorker = new DevWorker({
              name: options.name,
              remote: remote,
              host: host ? _extends({}, host, {
                remoteTypeUrls: remoteTypeUrls
              }) : undefined,
              extraOptions: extraOptions,
              disableLiveReload: devOptions.disableLiveReload,
              disableHotTypesReload: devOptions.disableHotTypesReload
            });
            var update = function update() {
              var _devWorker;
              return (_devWorker = devWorker) == null ? void 0 : _devWorker.update();
            };
            server.watcher.on('change', update);
            server.watcher.on('add', update);
            server.watcher.on('unlink', update);
            (_server$httpServer = server.httpServer) == null || _server$httpServer.once('close', function () {
              var _devWorker2;
              (_devWorker2 = devWorker) == null || _devWorker2.exit();
              server.watcher.off('change', update);
              server.watcher.off('add', update);
              server.watcher.off('unlink', update);
            });
          };
          var remoteTypeUrls;
          var _temp = function () {
            if (host) {
              return Promise.resolve(new Promise(function (resolve) {
                consumeTypesAPI({
                  host: host,
                  extraOptions: extraOptions,
                  displayErrorInTerminal: normalizedDtsOptions.displayErrorInTerminal
                }, resolve);
              })).then(function (_Promise) {
                remoteTypeUrls = _Promise;
              });
            }
          }();
          return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
        } catch (e) {
          return Promise.reject(e);
        }
      };
      startDevWorker()["catch"](function (error) {
        logDtsError(error, normalizedDtsOptions);
      });
    }
  };
  var buildPlugin = {
    name: 'module-federation-dts-build',
    apply: 'build',
    configResolved: function configResolved(config) {
      resolvedConfig = config;
    },
    generateBundle: function generateBundle() {
      try {
        var _temp6 = function _temp6() {
          var generateOptions;
          try {
            generateOptions = normalizeGenerateTypesOptions({
              context: context,
              outputDir: outputDir,
              dtsOptions: normalizedDtsOptions,
              pluginOptions: dtsModuleFederationConfig
            });
          } catch (error) {
            logDtsError(error, normalizedDtsOptions);
            return;
          }
          if (!generateOptions) {
            return;
          }
          var _temp4 = _catch(function () {
            return Promise.resolve(generateTypesAPI({
              dtsManagerOptions: generateOptions
            })).then(function () {});
          }, function (error) {
            logDtsError(error, normalizedDtsOptions);
          });
          if (_temp4 && _temp4.then) return _temp4.then(function () {});
        };
        if (hasGeneratedBundle) {
          return Promise.resolve();
        }
        hasGeneratedBundle = true;
        if (!resolvedConfig) {
          return Promise.resolve();
        }
        var normalizedDtsOptions;
        try {
          normalizedDtsOptions = normalizeDtsOptions(dtsModuleFederationConfig, resolvedConfig.root);
        } catch (error) {
          logDtsError(error, options.dts);
          return Promise.resolve();
        }
        if (typeof normalizedDtsOptions !== 'object') {
          return Promise.resolve();
        }
        var context = resolvedConfig.root;
        var outputDir = resolveOutputDir(resolvedConfig);
        var consumeOptions;
        try {
          consumeOptions = normalizeConsumeTypesOptions({
            context: context,
            dtsOptions: normalizedDtsOptions,
            pluginOptions: dtsModuleFederationConfig
          });
        } catch (error) {
          logDtsError(error, normalizedDtsOptions);
          return Promise.resolve();
        }
        var _temp5 = function (_consumeOptions) {
          if ((_consumeOptions = consumeOptions) != null && (_consumeOptions = _consumeOptions.host) != null && _consumeOptions.typesOnBuild) {
            var _temp3 = _catch(function () {
              return Promise.resolve(consumeTypesAPI(consumeOptions)).then(function () {});
            }, function (error) {
              logDtsError(error, normalizedDtsOptions);
            });
            if (_temp3 && _temp3.then) return _temp3.then(function () {});
          }
        }();
        return Promise.resolve(_temp5 && _temp5.then ? _temp5.then(_temp6) : _temp6(_temp5));
      } catch (e) {
        return Promise.reject(e);
      }
    }
  };
  return [devPlugin, buildPlugin];
}

function normalizeExposesItem(key, item) {
  var importPath = '';
  if (typeof item === 'string') {
    importPath = item;
  }
  if (typeof item === 'object') {
    importPath = item["import"];
  }
  return {
    "import": importPath
  };
}
function normalizeExposes(exposes) {
  if (!exposes) return {};
  var res = {};
  Object.keys(exposes).forEach(function (key) {
    res[key] = normalizeExposesItem(key, exposes[key]);
  });
  return res;
}
function normalizeRemotes(remotes) {
  if (!remotes) return {};
  var result = {};
  if (typeof remotes === 'object') {
    Object.keys(remotes).forEach(function (key) {
      result[key] = normalizeRemoteItem(key, remotes[key]);
    });
  }
  return result;
}
function normalizeRemoteItem(key, remote) {
  if (typeof remote === 'string') {
    var _remote$split = remote.split('@'),
      entryGlobalName = _remote$split[0];
    var entry = remote.replace(entryGlobalName + '@', '');
    return {
      type: 'var',
      name: key,
      entry: entry,
      entryGlobalName: entryGlobalName,
      shareScope: 'default'
    };
  }
  return Object.assign({
    type: 'var',
    name: key,
    shareScope: 'default',
    entryGlobalName: key
  }, remote);
}
function removePathFromNpmPackage(packageString) {
  // 匹配npm包名的正则表达式，忽略路径部分
  var regex = /^(?:@[^/]+\/)?[^/]+/;
  // 使用正则表达式匹配并提取包名
  var match = packageString.match(regex);
  // 返回匹配到的包名，如果没有匹配到则返回原字符串
  return match ? match[0] : packageString;
}
/**
 * Tries to find the package.json's version of a shared package
 * if `package.json` is not declared in `exports`
 * @param {string} sharedName
 * @returns {string | undefined}
 */
function searchPackageVersion(sharedName) {
  try {
    var sharedPath = require.resolve(sharedName);
    var potentialPackageJsonDir = path.dirname(sharedPath);
    var rootDir = path.parse(potentialPackageJsonDir).root;
    while (path.parse(potentialPackageJsonDir).base !== 'node_modules' && potentialPackageJsonDir !== rootDir) {
      var potentialPackageJsonPath = path.join(potentialPackageJsonDir, 'package.json');
      if (fs.existsSync(potentialPackageJsonPath)) {
        var potentialPackageJson = require(potentialPackageJsonPath);
        if (typeof potentialPackageJson == 'object' && potentialPackageJson !== null && typeof potentialPackageJson.version === 'string' && potentialPackageJson.name === sharedName) {
          return potentialPackageJson.version;
        }
      }
      potentialPackageJsonDir = path.dirname(potentialPackageJsonDir);
    }
  } catch (_) {}
  return undefined;
}
function normalizeShareItem(key, shareItem) {
  var version;
  try {
    try {
      version = require(path.join(removePathFromNpmPackage(key), 'package.json')).version;
    } catch (e1) {
      try {
        var localPath = path.join(process.cwd(), 'node_modules', removePathFromNpmPackage(key), 'package.json');
        version = require(localPath).version;
      } catch (e2) {
        version = searchPackageVersion(key);
        if (!version) console.error(e1);
      }
    }
  } catch (e) {
    console.error("Unexpected error resolving version for " + key + ":", e);
  }
  if (typeof shareItem === 'string') {
    return {
      name: shareItem,
      version: version,
      scope: 'default',
      from: '',
      shareConfig: {
        "import": undefined,
        singleton: false,
        requiredVersion: version ? "^" + version : '*'
      }
    };
  }
  return {
    name: key,
    from: '',
    version: shareItem.version || version,
    scope: shareItem.shareScope || 'default',
    shareConfig: {
      "import": typeof shareItem === 'object' ? shareItem["import"] : undefined,
      singleton: shareItem.singleton || false,
      requiredVersion: shareItem.requiredVersion || (version ? "^" + version : '*'),
      strictVersion: !!shareItem.strictVersion
    }
  };
}
function normalizeShared(shared) {
  if (!shared) return {};
  var result = {};
  if (Array.isArray(shared)) {
    shared.forEach(function (key) {
      result[key] = normalizeShareItem(key, key);
    });
    return result;
  }
  if (typeof shared === 'object') {
    Object.keys(shared).forEach(function (key) {
      result[key] = normalizeShareItem(key, shared[key]);
    });
  }
  return result;
}
function normalizeLibrary(library) {
  if (!library) return undefined;
  return library;
}
function normalizeManifest(manifest) {
  if (manifest === void 0) {
    manifest = false;
  }
  if (typeof manifest === 'boolean') {
    return manifest;
  }
  return Object.assign({
    filePath: '',
    disableAssetsAnalyze: false,
    fileName: 'mf-manifest.json'
  }, manifest);
}
var config;
function getNormalizeModuleFederationOptions() {
  return config;
}
function getNormalizeShareItem(key) {
  var options = getNormalizeModuleFederationOptions();
  var shareItem = options.shared[key] || options.shared[removePathFromNpmPackage(key)] || options.shared[removePathFromNpmPackage(key) + '/'];
  return shareItem;
}
function normalizeModuleFederationOptions(options) {
  if (options.virtualModuleDir && options.virtualModuleDir.includes('/')) {
    throw new Error("Invalid virtualModuleDir: \"" + options.virtualModuleDir + "\". " + "The virtualModuleDir option cannot contain slashes (/). " + "Please use a single directory name like '__mf__virtual__your_app_name'.");
  }
  return config = {
    exposes: normalizeExposes(options.exposes),
    filename: options.filename || 'remoteEntry-[hash]',
    library: normalizeLibrary(options.library),
    name: options.name,
    // remoteType: options.remoteType,
    remotes: normalizeRemotes(options.remotes),
    runtime: options.runtime,
    shareScope: options.shareScope || 'default',
    shared: normalizeShared(options.shared),
    runtimePlugins: options.runtimePlugins || [],
    implementation: options.implementation || require.resolve('@module-federation/runtime'),
    manifest: normalizeManifest(options.manifest),
    dev: options.dev,
    dts: options.dts,
    getPublicPath: options.getPublicPath,
    publicPath: options.publicPath,
    shareStrategy: options.shareStrategy || 'version-first',
    ignoreOrigin: options.ignoreOrigin || false,
    virtualModuleDir: options.virtualModuleDir || '__mf__virtual',
    hostInitInjectLocation: options.hostInitInjectLocation || 'html',
    bundleAllCSS: options.bundleAllCSS || false,
    moduleParseTimeout: options.moduleParseTimeout || 10,
    varFilename: options.varFilename
  };
}

/**
 * Escaping rules:
 * Convert using the format __${mapping}__, where _ and $ are not allowed in npm package names but can be used in variable names.
 *  @ => 1
 *  / => 2
 *  - => 3
 *  . => 4
 */
/**
 * Encodes a package name into a valid file name.
 * @param {string} name - The package name, e.g., "@scope/xx-xx.xx".
 * @returns {string} - The encoded file name.
 */
function packageNameEncode(name) {
  if (typeof name !== 'string') throw new Error('A string package name is required');
  return name.replace(/@/g, '_mf_0_').replace(/\//g, '_mf_1_').replace(/-/g, '_mf_2_').replace(/\./g, '_mf_3_');
}
/**
 * Decodes an encoded file name back to the original package name.
 * @param {string} encoded - The encoded file name, e.g., "_mf_0_scope_mf_1_xx_mf_2_xx_mf_3_xx".
 * @returns {string} - The decoded package name.
 */
function packageNameDecode(encoded) {
  if (typeof encoded !== 'string') throw new Error('A string encoded file name is required');
  return encoded.replace(/_mf_0_/g, '@').replace(/_mf_1_/g, '/').replace(/_mf_2_/g, '-').replace(/_mf_3_/g, '.');
}

/**
 * https://github.com/module-federation/vite/issues/68
 */
function getLocalSharedImportMapPath_temp() {
  var _getNormalizeModuleFe = getNormalizeModuleFederationOptions(),
    name = _getNormalizeModuleFe.name;
  return path__default.resolve('.__mf__temp', packageNameEncode(name), 'localSharedImportMap');
}
function writeLocalSharedImportMap_temp(content) {
  var localSharedImportMapId = getLocalSharedImportMapPath_temp();
  createFile(localSharedImportMapId + '.js', '\n// Windows temporarily needs this file, https://github.com/module-federation/vite/issues/68\n' + content);
}
function createFile(filePath, content) {
  var dir = path__default.dirname(filePath);
  mkdirSync(dir, {
    recursive: true
  });
  writeFileSync(filePath, content);
}

/**
 * Serializes a JavaScript object into a string of source code that can be evaluated.
 * This function is used to create runtime plugin options without relying solely on JSON.stringify,
 * allowing support for non-JSON types like RegExp, Date, Map, Set, and Functions.
 * It also safely handles circular references.
 *
 * @param {Record<string, unknown>} options - The options object to serialize.
 * @returns {string} The resulting JavaScript source code string.
 */
function serializeRuntimeOptions(options) {
  // Use a WeakSet to track objects already encountered, which helps in detecting circular references.
  var seenObjects = new WeakSet();
  /**
   * Recursive inner function to serialize any value into a source code string.
   */
  function valueToCode(val) {
    // 1. Handle primitive values
    if (val === null) return 'null';
    var type = typeof val;
    if (type === 'string') return JSON.stringify(val);
    if (type === 'number' || type === 'boolean') return String(val);
    if (type === 'undefined') return 'undefined';
    // Handle Symbol
    if (type === 'symbol') {
      var _val$description;
      var desc = (_val$description = val.description) != null ? _val$description : '';
      return "Symbol(" + JSON.stringify(desc) + ")";
    }
    // Handle Function (returns the function's source code)
    if (type === 'function') return val.toString();
    // 2. Handle special built-in objects
    if (val instanceof Date) return "new Date(" + JSON.stringify(val.toISOString()) + ")";
    if (val instanceof RegExp) {
      return "new RegExp(" + JSON.stringify(val.source) + ", " + JSON.stringify(val.flags) + ")";
    }
    // 3. Check for circular references and mark object as seen
    // This applies to objects, arrays, maps, and sets.
    if (type === 'object') {
      if (seenObjects.has(val)) {
        // This object has been seen previously in the recursion path
        return "\"__circular__\"";
      }
      seenObjects.add(val);
    }
    // 4. Handle Array, Map, Set
    if (Array.isArray(val)) {
      // Recursively serialize each element
      return "[" + val.map(valueToCode).join(', ') + "]";
    }
    if (val instanceof Map) {
      // Serialize Map entries into an array of [key, value] pairs
      var entries = Array.from(val.entries()).map(function (_ref) {
        var k = _ref[0],
          v = _ref[1];
        return "[" + valueToCode(k) + ", " + valueToCode(v) + "]";
      });
      return "new Map([" + entries.join(', ') + "])";
    }
    if (val instanceof Set) {
      // Serialize Set values into an array
      var items = Array.from(val.values()).map(valueToCode);
      return "new Set([" + items.join(', ') + "])";
    }
    // 5. Handle plain objects (the default object type)
    if (type === 'object') {
      var properties = [];
      // Iterate over the object's own enumerable properties
      for (var key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          // Wrap the key in JSON.stringify to handle non-identifier keys
          properties.push(JSON.stringify(key) + ": " + valueToCode(val[key]));
        }
      }
      return "{" + properties.join(', ') + "}";
    }
    // 6. Fallback case (e.g., BigInt, other object types)
    // Coerce to string and then JSON.stringify that string for safety
    return JSON.stringify(String(val));
  }
  // Start serialization for the top-level object
  var topLevelProps = [];
  // Iterate over the properties of the root 'options' object
  for (var key in options) {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      topLevelProps.push(JSON.stringify(key) + ": " + valueToCode(options[key]));
    }
  }
  return "{" + topLevelProps.join(', ') + "}";
}

// Cache root path
var rootDir;
function findNodeModulesDir(root) {
  if (root === void 0) {
    root = process.cwd();
  }
  var currentDir = root;
  while (currentDir !== parse(currentDir).root) {
    var nodeModulesPath = join(currentDir, 'node_modules');
    if (existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }
    currentDir = dirname(currentDir);
  }
  return '';
}
// Cache nodeModulesDir result to avoid repeated calculations
var cachedNodeModulesDir;
function getNodeModulesDir() {
  if (!cachedNodeModulesDir) {
    cachedNodeModulesDir = findNodeModulesDir(rootDir);
  }
  return cachedNodeModulesDir;
}
function getSuffix(name) {
  var base = basename(name);
  var dotIndex = base.lastIndexOf('.');
  if (dotIndex > 0 && dotIndex < base.length - 1) {
    return base.slice(dotIndex);
  }
  return '.js';
}
var patternMap = {};
var cacheMap = {};
/**
 * Physically generate files as virtual modules under node_modules/__mf__virtual/*
 */
function assertModuleFound(tag, str) {
  if (str === void 0) {
    str = '';
  }
  var module = VirtualModule.findModule(tag, str);
  if (!module) {
    throw new Error("Module Federation shared module '" + str + "' not found. Please ensure it's installed as a dependency in your package.json.");
  }
  return module;
}
var VirtualModule = /*#__PURE__*/function () {
  function VirtualModule(name, tag, suffix) {
    if (tag === void 0) {
      tag = '__mf_v__';
    }
    if (suffix === void 0) {
      suffix = '';
    }
    this.name = void 0;
    this.tag = void 0;
    this.suffix = void 0;
    this.inited = false;
    this.name = name;
    this.tag = tag;
    this.suffix = suffix || getSuffix(name);
    if (!cacheMap[this.tag]) cacheMap[this.tag] = {};
    cacheMap[this.tag][this.name] = this;
  }
  /**
   * Set the root path for finding node_modules
   * @param root - Root path
   */
  VirtualModule.setRoot = function setRoot(root) {
    rootDir = root;
    // Reset cache to ensure using the new root path
    cachedNodeModulesDir = undefined;
  }
  /**
   * Ensure virtual package directory exists
   */;
  VirtualModule.ensureVirtualPackageExists = function ensureVirtualPackageExists() {
    var nodeModulesDir = getNodeModulesDir();
    var _getNormalizeModuleFe = getNormalizeModuleFederationOptions(),
      virtualModuleDir = _getNormalizeModuleFe.virtualModuleDir;
    var virtualPackagePath = resolve(nodeModulesDir, virtualModuleDir);
    if (!existsSync(virtualPackagePath)) {
      mkdirSync(virtualPackagePath);
      writeFileSync(resolve(virtualPackagePath, 'empty.js'), '');
      writeFileSync(resolve(virtualPackagePath, 'package.json'), JSON.stringify({
        name: virtualModuleDir,
        main: 'empty.js'
      }));
    }
  };
  VirtualModule.findModule = function findModule(tag, str) {
    if (str === void 0) {
      str = '';
    }
    if (!patternMap[tag]) patternMap[tag] = new RegExp("(.*" + packageNameEncode(tag) + "(.+?)" + packageNameEncode(tag) + ".*)");
    var moduleName = (str.match(patternMap[tag]) || [])[2];
    if (moduleName) return cacheMap[tag][packageNameDecode(moduleName)];
    return undefined;
  };
  var _proto = VirtualModule.prototype;
  _proto.getPath = function getPath() {
    return resolve(getNodeModulesDir(), this.getImportId());
  };
  _proto.getImportId = function getImportId() {
    var _getNormalizeModuleFe2 = getNormalizeModuleFederationOptions(),
      mfName = _getNormalizeModuleFe2.name,
      virtualModuleDir = _getNormalizeModuleFe2.virtualModuleDir;
    return virtualModuleDir + "/" + packageNameEncode("" + mfName + this.tag + this.name + this.tag) + this.suffix;
  };
  _proto.writeSync = function writeSync(code, force) {
    if (!force && this.inited) return;
    if (!this.inited) {
      this.inited = true;
    }
    writeFileSync(this.getPath(), code);
  };
  _proto.write = function write(code) {
    writeFile(this.getPath(), code, function () {});
  };
  return VirtualModule;
}();

var VIRTUAL_EXPOSES = 'virtual:mf-exposes';
function generateExposes() {
  var options = getNormalizeModuleFederationOptions();
  return "\n    export default {\n    " + Object.keys(options.exposes).map(function (key) {
    return "\n        " + JSON.stringify(key) + ": async () => {\n          const importModule = await import(" + JSON.stringify(options.exposes[key]["import"]) + ")\n          const exportModule = {}\n          Object.assign(exportModule, importModule)\n          Object.defineProperty(exportModule, \"__esModule\", {\n            value: true,\n            enumerable: false\n          })\n          return exportModule\n        }\n      ";
  }).join(',') + "\n  }\n  ";
}

var virtualRuntimeInitStatus = new VirtualModule('runtimeInit');
function writeRuntimeInitStatus() {
  // Use globalThis singleton to ensure only one initPromise exists
  var globalKey = "__mf_init__" + virtualRuntimeInitStatus.getImportId() + "__";
  virtualRuntimeInitStatus.writeSync("\n    const globalKey = " + JSON.stringify(globalKey) + "\n    if (!globalThis[globalKey]) {\n      let initResolve, initReject\n      const initPromise = new Promise((re, rj) => {\n        initResolve = re\n        initReject = rj\n      })\n      globalThis[globalKey] = {\n        initPromise,\n        initResolve,\n        initReject\n      }\n    }\n    module.exports = globalThis[globalKey]\n    ");
}

var cacheRemoteMap = {};
var LOAD_REMOTE_TAG = '__loadRemote__';
function getRemoteVirtualModule(remote, command) {
  if (!cacheRemoteMap[remote]) {
    cacheRemoteMap[remote] = new VirtualModule(remote, LOAD_REMOTE_TAG, '.js');
    cacheRemoteMap[remote].writeSync(generateRemotes(remote, command));
  }
  var virtual = cacheRemoteMap[remote];
  return virtual;
}
var usedRemotesMap = {
  // remote1: {remote1/App, remote1, remote1/Button}
};
function addUsedRemote(remoteKey, remoteModule) {
  if (!usedRemotesMap[remoteKey]) usedRemotesMap[remoteKey] = new Set();
  usedRemotesMap[remoteKey].add(remoteModule);
}
function getUsedRemotesMap() {
  return usedRemotesMap;
}
function generateRemotes(id, command) {
  return "\n    const {initPromise} = require(\"" + virtualRuntimeInitStatus.getImportId() + "\")\n    const res = initPromise.then(runtime => runtime.loadRemote(" + JSON.stringify(id) + "))\n    const exportModule = " + (command !== 'build' ? '/*mf top-level-await placeholder replacement mf*/' : 'await ') + "initPromise.then(_ => res)\n    module.exports = exportModule\n  ";
}

/**
 * Even the resolveId hook cannot interfere with vite pre-build,
 * and adding query parameter virtual modules will also fail.
 * You can only proxy to the real file through alias
 */
// *** __prebuild__
var preBuildCacheMap = {};
var PREBUILD_TAG = '__prebuild__';
function writePreBuildLibPath(pkg) {
  if (!preBuildCacheMap[pkg]) preBuildCacheMap[pkg] = new VirtualModule(pkg, PREBUILD_TAG);
  preBuildCacheMap[pkg].writeSync('');
}
function getPreBuildLibImportId(pkg) {
  if (!preBuildCacheMap[pkg]) preBuildCacheMap[pkg] = new VirtualModule(pkg, PREBUILD_TAG);
  var importId = preBuildCacheMap[pkg].getImportId();
  return importId;
}
// *** __loadShare__
var LOAD_SHARE_TAG = '__loadShare__';
var loadShareCacheMap = {};
function getLoadShareModulePath(pkg) {
  if (!loadShareCacheMap[pkg]) loadShareCacheMap[pkg] = new VirtualModule(pkg, LOAD_SHARE_TAG, '.js');
  var filepath = loadShareCacheMap[pkg].getPath();
  return filepath;
}
function writeLoadShareModule(pkg, shareItem, command) {
  loadShareCacheMap[pkg].writeSync("\n    ;() => import(" + JSON.stringify(getPreBuildLibImportId(pkg)) + ").catch(() => {});\n    // dev uses dynamic import to separate chunks\n    " + (command !== 'build' ? ";() => import(" + JSON.stringify(pkg) + ").catch(() => {});" : '') + "\n    const {initPromise} = require(\"" + virtualRuntimeInitStatus.getImportId() + "\")\n    const res = initPromise.then(runtime => runtime.loadShare(" + JSON.stringify(pkg) + ", {\n      customShareInfo: {shareConfig:{\n        singleton: " + shareItem.shareConfig.singleton + ",\n        strictVersion: " + shareItem.shareConfig.strictVersion + ",\n        requiredVersion: " + JSON.stringify(shareItem.shareConfig.requiredVersion) + "\n      }}\n    }))\n    const exportModule = " + (command !== 'build' ? '/*mf top-level-await placeholder replacement mf*/' : 'await ') + "res.then(factory => factory())\n    module.exports = exportModule\n  ");
}

var usedShares = new Set();
function getUsedShares() {
  return usedShares;
}
function addUsedShares(pkg) {
  usedShares.add(pkg);
}
// *** Expose locally provided shared modules here
new VirtualModule('localSharedImportMap');
function getLocalSharedImportMapPath() {
  return getLocalSharedImportMapPath_temp();
  // return localSharedImportMapModule.getPath()
}
var prevSharedCount;
function writeLocalSharedImportMap() {
  var sharedCount = getUsedShares().size;
  if (prevSharedCount !== sharedCount) {
    prevSharedCount = sharedCount;
    writeLocalSharedImportMap_temp(generateLocalSharedImportMap());
    //   localSharedImportMapModule.writeSync(generateLocalSharedImportMap(), true)
  }
}
function generateLocalSharedImportMap() {
  var options = getNormalizeModuleFederationOptions();
  return "\n    import {loadShare} from \"@module-federation/runtime\";\n    const importMap = {\n      " + Array.from(getUsedShares()).sort().map(function (pkg) {
    var shareItem = getNormalizeShareItem(pkg);
    return "\n        " + JSON.stringify(pkg) + ": async () => {\n          " + ((shareItem == null ? void 0 : shareItem.shareConfig["import"]) === false ? "throw new Error(`Shared module '${" + JSON.stringify(pkg) + "}' must be provided by host`);" : "let pkg = await import(\"" + getPreBuildLibImportId(pkg) + "\");\n            return pkg;") + "\n        }\n      ";
  }).join(',') + "\n    }\n      const usedShared = {\n      " + Array.from(getUsedShares()).sort().map(function (key) {
    var shareItem = getNormalizeShareItem(key);
    if (!shareItem) return null;
    return "\n          " + JSON.stringify(key) + ": {\n            name: " + JSON.stringify(key) + ",\n            version: " + JSON.stringify(shareItem.version) + ",\n            scope: [" + JSON.stringify(shareItem.scope) + "],\n            loaded: false,\n            from: " + JSON.stringify(options.name) + ",\n            async get () {\n              if (" + (shareItem.shareConfig["import"] === false) + ") {\n                throw new Error(`Shared module '${" + JSON.stringify(key) + "}' must be provided by host`);\n              }\n              usedShared[" + JSON.stringify(key) + "].loaded = true\n              const {" + JSON.stringify(key) + ": pkgDynamicImport} = importMap\n              const res = await pkgDynamicImport()\n              const exportModule = {...res}\n              // All npm packages pre-built by vite will be converted to esm\n              Object.defineProperty(exportModule, \"__esModule\", {\n                value: true,\n                enumerable: false\n              })\n              return function () {\n                return exportModule\n              }\n            },\n            shareConfig: {\n              singleton: " + shareItem.shareConfig.singleton + ",\n              requiredVersion: " + JSON.stringify(shareItem.shareConfig.requiredVersion) + ",\n              " + (shareItem.shareConfig["import"] === false ? 'import: false,' : '') + "\n            }\n          }\n        ";
  }).filter(function (x) {
    return x !== null;
  }).join(',') + "\n    }\n      const usedRemotes = [" + Object.keys(getUsedRemotesMap()).map(function (key) {
    var _JSON$stringify;
    var remote = options.remotes[key];
    if (!remote) return null;
    return "\n                {\n                  entryGlobalName: " + JSON.stringify(remote.entryGlobalName) + ",\n                  name: " + JSON.stringify(remote.name) + ",\n                  type: " + JSON.stringify(remote.type) + ",\n                  entry: " + JSON.stringify(remote.entry) + ",\n                  shareScope: " + ((_JSON$stringify = JSON.stringify(remote.shareScope)) != null ? _JSON$stringify : 'default') + ",\n                }\n          ";
  }).filter(function (x) {
    return x !== null;
  }).join(',') + "\n      ]\n      export {\n        usedShared,\n        usedRemotes\n      }\n      ";
}
var REMOTE_ENTRY_ID = 'virtual:mf-REMOTE_ENTRY_ID';
function generateRemoteEntry(options) {
  var pluginImportNames = options.runtimePlugins.map(function (p, i) {
    if (typeof p === 'string') {
      return ["$runtimePlugin_" + i, "import $runtimePlugin_" + i + " from \"" + p + "\";", "undefined"];
    } else {
      return ["$runtimePlugin_" + i, "import $runtimePlugin_" + i + " from \"" + p[0] + "\";", serializeRuntimeOptions(p[1])];
    }
  });
  // Generate importMap for dynamic imports of shared modules
  var importMapCode = Object.keys(options.shared || {}).sort().map(function (pkg) {
    var shareItem = options.shared[pkg];
    if (!shareItem) return null;
    return "\n        " + JSON.stringify(pkg) + ": async () => {\n          " + (shareItem.shareConfig["import"] === false ? "throw new Error(`Shared module '${" + JSON.stringify(pkg) + "}' must be provided by host`);" : "let pkg = await import(\"" + getPreBuildLibImportId(pkg) + "\");\n            return pkg;") + "\n        }";
  }).filter(function (x) {
    return x !== null;
  }).join(',');
  // Generate usedShared inline from ALL configured shared dependencies
  // Use options.shared instead of getUsedShares() because the host needs to provide
  // all configured shared modules, not just the ones dynamically imported
  var usedSharedCode = Object.keys(options.shared || {}).sort().map(function (key) {
    var shareItem = options.shared[key];
    if (!shareItem) return null;
    return "\n      " + JSON.stringify(key) + ": {\n        name: " + JSON.stringify(key) + ",\n        version: " + JSON.stringify(shareItem.version) + ",\n        scope: [" + JSON.stringify(shareItem.scope) + "],\n        loaded: false,\n        from: " + JSON.stringify(options.name) + ",\n        async get () {\n          if (" + (shareItem.shareConfig["import"] === false) + ") {\n            throw new Error(`Shared module '${" + JSON.stringify(key) + "}' must be provided by host`);\n          }\n          usedShared[" + JSON.stringify(key) + "].loaded = true\n          const {" + JSON.stringify(key) + ": pkgDynamicImport} = importMap\n          const res = await pkgDynamicImport()\n          const exportModule = {...res}\n          // All npm packages pre-built by vite will be converted to esm\n          Object.defineProperty(exportModule, \"__esModule\", {\n            value: true,\n            enumerable: false\n          })\n          return function () {\n            return exportModule\n          }\n        },\n        shareConfig: {\n          singleton: " + shareItem.shareConfig.singleton + ",\n          requiredVersion: " + JSON.stringify(shareItem.shareConfig.requiredVersion) + ",\n          " + (shareItem.shareConfig["import"] === false ? 'import: false,' : '') + "\n        }\n      }";
  }).filter(function (x) {
    return x !== null;
  }).join(',');
  var usedRemotesCode = Object.keys(getUsedRemotesMap()).map(function (key) {
    var _JSON$stringify2;
    var remote = options.remotes[key];
    if (!remote) return null;
    return "{\n        entryGlobalName: " + JSON.stringify(remote.entryGlobalName) + ",\n        name: " + JSON.stringify(remote.name) + ",\n        type: " + JSON.stringify(remote.type) + ",\n        entry: " + JSON.stringify(remote.entry) + ",\n        shareScope: " + ((_JSON$stringify2 = JSON.stringify(remote.shareScope)) != null ? _JSON$stringify2 : 'default') + ",\n      }";
  }).filter(function (x) {
    return x !== null;
  }).join(',');
  return "\n  import {init as runtimeInit, loadRemote} from \"@module-federation/runtime\";\n  " + pluginImportNames.map(function (item) {
    return item[1];
  }).join('\n') + "\n  import exposesMap from \"" + VIRTUAL_EXPOSES + "\"\n  import {\n    initResolve\n  } from \"" + virtualRuntimeInitStatus.getImportId() + "\"\n  const importMap = {" + importMapCode + "}\n  const usedShared = {" + usedSharedCode + "}\n  const usedRemotes = [" + usedRemotesCode + "]\n  const initTokens = {}\n  const shareScopeName = " + JSON.stringify(options.shareScope) + "\n  const mfName = " + JSON.stringify(options.name) + "\n  async function init(shared = {}, initScope = []) {\n    const initRes = runtimeInit({\n      name: mfName,\n      remotes: usedRemotes,\n      shared: usedShared,\n      plugins: [" + pluginImportNames.map(function (item) {
    return item[0] + "(" + item[2] + ")";
  }).join(', ') + "],\n      " + (options.shareStrategy ? "shareStrategy: '" + options.shareStrategy + "'" : '') + "\n    });\n    // handling circular init calls\n    var initToken = initTokens[shareScopeName];\n    if (!initToken)\n      initToken = initTokens[shareScopeName] = { from: mfName };\n    if (initScope.indexOf(initToken) >= 0) return;\n    initScope.push(initToken);\n    initRes.initShareScopeMap('" + options.shareScope + "', shared);\n    try {\n      await Promise.all(await initRes.initializeSharing('" + options.shareScope + "', {\n        strategy: '" + options.shareStrategy + "',\n        from: \"build\",\n        initScope\n      }));\n    } catch (e) {\n      console.error(e)\n    }\n    initResolve(initRes)\n    return initRes\n  }\n\n  function getExposes(moduleName) {\n    if (!(moduleName in exposesMap)) throw new Error(`Module ${moduleName} does not exist in container.`)\n    return (exposesMap[moduleName])().then(res => () => res)\n  }\n  export {\n      init,\n      getExposes as get\n  }\n  ";
}
/**
 * Inject entry file, automatically init when used as host,
 * and will not inject remoteEntry
 */
var HOST_AUTO_INIT_TAG = '__H_A_I__';
var hostAutoInitModule = new VirtualModule('hostAutoInit', HOST_AUTO_INIT_TAG);
function writeHostAutoInit() {
  hostAutoInitModule.writeSync("\n    const remoteEntryPromise = import(\"" + REMOTE_ENTRY_ID + "\")\n    // __tla only serves as a hack for vite-plugin-top-level-await.\n    Promise.resolve(remoteEntryPromise)\n      .then(remoteEntry => {\n        return Promise.resolve(remoteEntry.__tla)\n          .then(remoteEntry.init).catch(remoteEntry.init)\n      })\n    ");
}
function getHostAutoInitImportId() {
  return hostAutoInitModule.getImportId();
}
function getHostAutoInitPath() {
  return hostAutoInitModule.getPath();
}

function initVirtualModules() {
  writeLocalSharedImportMap();
  writeHostAutoInit();
  writeRuntimeInitStatus();
}

function findRemoteEntryFile(filename, bundle) {
  for (var _i = 0, _Object$entries = Object.entries(bundle); _i < _Object$entries.length; _i++) {
    var _Object$entries$_i = _Object$entries[_i],
      fileData = _Object$entries$_i[1];
    if (filename.replace(/[\[\]]/g, '_').replace(/\.[^/.]+$/, '') === fileData.name || fileData.name === 'remoteEntry') {
      return fileData.fileName; // We can return early since we only need to find remoteEntry once
    }
  }
}

var ASSET_TYPES = ['js', 'css'];
var LOAD_TIMINGS = ['sync', 'async'];
var JS_EXTENSIONS = ['.ts', '.tsx', '.jsx', '.mjs', '.cjs'];
/**
 * Creates an empty asset map structure for tracking JS and CSS assets
 * @returns Initialized asset map with sync/async arrays for JS and CSS
 */
var createEmptyAssetMap = function createEmptyAssetMap() {
  return {
    js: {
      sync: [],
      async: []
    },
    css: {
      sync: [],
      async: []
    }
  };
};
/**
 * Tracks an asset in the preload map with deduplication
 * @param map - The preload map to update
 * @param key - The module key to track under
 * @param fileName - The asset filename to track
 * @param isAsync - Whether the asset is loaded async
 * @param type - The asset type ('js' or 'css')
 */
var trackAsset = function trackAsset(map, key, fileName, isAsync, type) {
  if (!map[key]) {
    map[key] = createEmptyAssetMap();
  }
  var target = isAsync ? map[key][type].async : map[key][type].sync;
  if (!target.includes(fileName)) {
    target.push(fileName);
  }
};
/**
 * Checks if a file is a CSS file by extension
 * @param fileName - The filename to check
 * @returns True if file has a CSS extension (.css, .scss, .less)
 */
var isCSSFile = function isCSSFile(fileName) {
  return fileName.endsWith('.css') || fileName.endsWith('.scss') || fileName.endsWith('.less');
};
/**
 * Collects all CSS assets from the bundle
 * @param bundle - The Rollup output bundle
 * @returns Set of CSS asset filenames
 */
var collectCssAssets = function collectCssAssets(bundle) {
  var cssAssets = new Set();
  for (var _i = 0, _Object$entries = Object.entries(bundle); _i < _Object$entries.length; _i++) {
    var _Object$entries$_i = _Object$entries[_i],
      fileName = _Object$entries$_i[0],
      fileData = _Object$entries$_i[1];
    if (fileData.type === 'asset' && isCSSFile(fileName)) {
      cssAssets.add(fileName);
    }
  }
  return cssAssets;
};
/**
 * Checks if a chunk contains CSS modules (e.g. .css, .vanilla.css, .scss, .less)
 * by scanning its module list
 */
var chunkContainsCssModules = function chunkContainsCssModules(modules) {
  for (var _i2 = 0, _Object$keys = Object.keys(modules); _i2 < _Object$keys.length; _i2++) {
    var modulePath = _Object$keys[_i2];
    if (isCSSFile(modulePath)) {
      return true;
    }
  }
  return false;
};
/**
 * Processes module assets and tracks them in the files map
 * @param bundle - The Rollup output bundle
 * @param filesMap - The preload map to populate
 * @param moduleMatcher - Function that matches module paths to keys
 */
var processModuleAssets = function processModuleAssets(bundle, filesMap, moduleMatcher) {
  // Pre-collect all CSS assets in the bundle for fallback matching
  var bundleCssAssets = collectCssAssets(bundle);
  for (var _i3 = 0, _Object$entries2 = Object.entries(bundle); _i3 < _Object$entries2.length; _i3++) {
    var _Object$entries2$_i = _Object$entries2[_i3],
      fileName = _Object$entries2$_i[0],
      fileData = _Object$entries2$_i[1];
    if (fileData.type !== 'chunk') continue;
    if (!fileData.modules) continue;
    for (var _i4 = 0, _Object$keys2 = Object.keys(fileData.modules); _i4 < _Object$keys2.length; _i4++) {
      var _fileData$viteMetadat;
      var modulePath = _Object$keys2[_i4];
      var matchKey = moduleMatcher(modulePath);
      if (!matchKey) continue;
      // Track main JS chunk
      trackAsset(filesMap, matchKey, fileName, false, 'js');
      // Track CSS extracted by Vite's CSS pipeline (e.g. vanilla-extract, CSS modules).
      // Vite stores statically imported CSS on chunk.viteMetadata.importedCss
      var foundCssViaMetadata = false;
      if ((_fileData$viteMetadat = fileData.viteMetadata) != null && (_fileData$viteMetadat = _fileData$viteMetadat.importedCss) != null && _fileData$viteMetadat.size) {
        for (var _iterator = _createForOfIteratorHelperLoose(fileData.viteMetadata.importedCss), _step; !(_step = _iterator()).done;) {
          var cssFile = _step.value;
          trackAsset(filesMap, matchKey, cssFile, false, 'css');
          foundCssViaMetadata = true;
        }
      }
      // Fallback: In Vite environment builds, viteMetadata.importedCss may not be
      // populated even when the chunk contains CSS modules (e.g. vanilla-extract
      // .vanilla.css virtual modules). In this case, detect CSS modules in the
      // chunk's module list and associate corresponding CSS assets from the bundle.
      if (!foundCssViaMetadata && chunkContainsCssModules(fileData.modules)) {
        for (var _iterator2 = _createForOfIteratorHelperLoose(bundleCssAssets), _step2; !(_step2 = _iterator2()).done;) {
          var cssAsset = _step2.value;
          trackAsset(filesMap, matchKey, cssAsset, false, 'css');
        }
      }
      // Handle dynamic imports
      if (fileData.dynamicImports) {
        for (var _iterator3 = _createForOfIteratorHelperLoose(fileData.dynamicImports), _step3; !(_step3 = _iterator3()).done;) {
          var dynamicImport = _step3.value;
          var importData = bundle[dynamicImport];
          if (!importData) continue;
          var isCss = isCSSFile(dynamicImport);
          trackAsset(filesMap, matchKey, dynamicImport, true, isCss ? 'css' : 'js');
        }
      }
    }
  }
};
/**
 * Deduplicates assets in the files map
 * @param filesMap - The preload map to deduplicate
 * @returns New deduplicated preload map
 */
var deduplicateAssets = function deduplicateAssets(filesMap) {
  var result = {};
  for (var _i5 = 0, _Object$entries3 = Object.entries(filesMap); _i5 < _Object$entries3.length; _i5++) {
    var _Object$entries3$_i = _Object$entries3[_i5],
      key = _Object$entries3$_i[0],
      assetMaps = _Object$entries3$_i[1];
    result[key] = createEmptyAssetMap();
    for (var _i6 = 0, _ASSET_TYPES = ASSET_TYPES; _i6 < _ASSET_TYPES.length; _i6++) {
      var type = _ASSET_TYPES[_i6];
      for (var _i7 = 0, _LOAD_TIMINGS = LOAD_TIMINGS; _i7 < _LOAD_TIMINGS.length; _i7++) {
        var timing = _LOAD_TIMINGS[_i7];
        result[key][type][timing] = Array.from(new Set(assetMaps[type][timing]));
      }
    }
  }
  return result;
};
/**
 * Builds a mapping between module files and their share keys
 * @param shareKeys - Set of share keys to map
 * @param resolveFn - Function to resolve module paths
 * @returns Map of file paths to their corresponding share keys
 */
var buildFileToShareKeyMap = function buildFileToShareKeyMap(shareKeys, resolveFn) {
  try {
    var fileToShareKey = new Map();
    return Promise.resolve(Promise.all(Array.from(shareKeys).map(function (shareKey) {
      return resolveFn(getPreBuildLibImportId(shareKey)).then(function (resolution) {
        var _resolution$id;
        return {
          shareKey: shareKey,
          file: resolution == null || (_resolution$id = resolution.id) == null ? void 0 : _resolution$id.split('?')[0]
        };
      })["catch"](function () {
        return null;
      });
    }))).then(function (resolutions) {
      for (var _iterator4 = _createForOfIteratorHelperLoose(resolutions), _step4; !(_step4 = _iterator4()).done;) {
        var resolution = _step4.value;
        if (resolution != null && resolution.file) {
          fileToShareKey.set(resolution.file, resolution.shareKey);
        }
      }
      return fileToShareKey;
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

/**
 * Resolves the public path for remote entries
 * @param options - Module Federation options
 * @param viteBase - Vite's base config value
 * @param originalBase - Original base config before any transformations
 * @returns The resolved public path
 */
function resolvePublicPath(options, viteBase, originalBase) {
  // Use explicitly set publicPath if provided
  if (options.publicPath) {
    return options.publicPath;
  }
  // Handle empty original base case
  if (originalBase === '') {
    return 'auto';
  }
  // Use viteBase if available, ensuring it ends with a slash
  if (viteBase) {
    return viteBase.replace(/\/?$/, '/');
  }
  // Fallback to auto if no base is specified
  return 'auto';
}

var Manifest = function Manifest() {
  var mfOptions = getNormalizeModuleFederationOptions();
  var name = mfOptions.name,
    filename = mfOptions.filename,
    getPublicPath = mfOptions.getPublicPath,
    manifestOptions = mfOptions.manifest,
    varFilename = mfOptions.varFilename;
  var mfManifestName = '';
  if (manifestOptions === true) {
    mfManifestName = 'mf-manifest.json';
  }
  if (typeof manifestOptions !== 'boolean') {
    mfManifestName = path.join((manifestOptions == null ? void 0 : manifestOptions.filePath) || '', (manifestOptions == null ? void 0 : manifestOptions.fileName) || '');
  }
  var root;
  var remoteEntryFile;
  var publicPath;
  var _command;
  var _originalConfigBase;
  var viteConfig;
  /**
   * Adds global CSS assets to all module exports
   * @param filesMap - The preload map to update
   * @param cssAssets - Set of CSS asset filenames to add
   */
  var addCssAssetsToAllExports = function addCssAssetsToAllExports(filesMap, cssAssets) {
    Object.keys(filesMap).forEach(function (key) {
      cssAssets.forEach(function (cssAsset) {
        trackAsset(filesMap, key, cssAsset, false, 'css');
      });
    });
  };
  return [{
    name: 'module-federation-manifest',
    apply: 'serve',
    /**
     * Stores resolved Vite config for later use
     */
    /**
     * Finalizes configuration after all plugins are resolved
     * @param config - Fully resolved Vite config
     */
    configResolved: function configResolved(config) {
      viteConfig = config;
    },
    /**
     * Configures dev server middleware to handle manifest requests
     * @param server - Vite dev server instance
     */
    configureServer: function configureServer(server) {
      server.middlewares.use(function (req, res, next) {
        var _req$url;
        if (!mfManifestName) {
          next();
          return;
        }
        if (((_req$url = req.url) == null ? void 0 : _req$url.replace(/\?.*/, '')) === (viteConfig.base + mfManifestName).replace(/^\/?/, '/')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(_extends({}, generateMFManifest({}), {
            id: name,
            name: name,
            metaData: {
              name: name,
              type: 'app',
              buildInfo: {
                buildVersion: '1.0.0',
                buildName: name
              },
              remoteEntry: {
                name: filename,
                path: '',
                type: 'module'
              },
              ssrRemoteEntry: {
                name: filename,
                path: '',
                type: 'module'
              },
              varRemoteEntry: varFilename ? {
                name: varFilename,
                path: '',
                type: 'var'
              } : undefined,
              types: {
                path: '',
                name: ''
              },
              globalName: name,
              pluginVersion: '0.2.5',
              publicPath: publicPath
            }
          })));
        } else {
          next();
        }
      });
    }
  }, {
    name: 'module-federation-manifest',
    enforce: 'post',
    /**
     * Initial plugin configuration
     * @param config - Vite config object
     * @param command - Current Vite command (serve/build)
     */
    config: function config(_config, _ref) {
      var command = _ref.command;
      if (!_config.build) _config.build = {};
      if (!_config.build.manifest) {
        _config.build.manifest = _config.build.manifest || !!manifestOptions;
      }
      _command = command;
      _originalConfigBase = _config.base;
    },
    configResolved: function configResolved(config) {
      root = config.root;
      var base = config.base;
      if (_command === 'serve') {
        base = (config.server.origin || '') + config.base;
      }
      publicPath = resolvePublicPath(mfOptions, base, _originalConfigBase);
    },
    /**
     * Generates the module federation manifest file
     * @param options - Rollup output options
     * @param bundle - Generated bundle assets
     */
    generateBundle: function generateBundle(options, bundle) {
      try {
        var _this = this;
        if (!mfManifestName) return Promise.resolve();
        var filesMap = {};
        var foundRemoteEntryFile = findRemoteEntryFile(mfOptions.filename, bundle);
        // First pass: Find remoteEntry file
        if (foundRemoteEntryFile) {
          remoteEntryFile = foundRemoteEntryFile;
        }
        // Second pass: Collect all CSS assets
        var allCssAssets = mfOptions.bundleAllCSS ? collectCssAssets(bundle) : new Set();
        var exposesModules = Object.keys(mfOptions.exposes).map(function (item) {
          return mfOptions.exposes[item]["import"];
        });
        // Process exposed modules
        processModuleAssets(bundle, filesMap, function (modulePath) {
          var absoluteModulePath = path.resolve(root, modulePath);
          return exposesModules.find(function (exposeModule) {
            var exposePath = path.resolve(root, exposeModule);
            // First try exact path match
            if (absoluteModulePath === exposePath) {
              return true;
            }
            // Then try path match without known extensions
            var getPathWithoutKnownExt = function getPathWithoutKnownExt(filePath) {
              var ext = path.extname(filePath);
              return JS_EXTENSIONS.includes(ext) ? path.join(path.dirname(filePath), path.basename(filePath, ext)) : filePath;
            };
            var modulePathNoExt = getPathWithoutKnownExt(absoluteModulePath);
            var exposePathNoExt = getPathWithoutKnownExt(exposePath);
            return modulePathNoExt === exposePathNoExt;
          });
        });
        // Process shared modules
        return Promise.resolve(buildFileToShareKeyMap(getUsedShares(), _this.resolve.bind(_this))).then(function (fileToShareKey) {
          processModuleAssets(bundle, filesMap, function (modulePath) {
            return fileToShareKey.get(modulePath);
          });
          // Add all CSS assets to every export if bundleAllCSS is enabled
          if (mfOptions.bundleAllCSS) {
            addCssAssetsToAllExports(filesMap, allCssAssets);
          }
          // Final deduplication of all assets
          filesMap = deduplicateAssets(filesMap);
          _this.emitFile({
            type: 'asset',
            fileName: mfManifestName,
            source: JSON.stringify(generateMFManifest(filesMap))
          });
        });
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }];
  /**
   * Generates the final manifest JSON structure
   * @param preloadMap - Map of module assets to include
   * @returns Complete manifest object
   */
  function generateMFManifest(preloadMap) {
    var options = getNormalizeModuleFederationOptions();
    var name = options.name,
      varFilename = options.varFilename;
    var remoteEntry = {
      name: remoteEntryFile,
      path: '',
      type: 'module'
    };
    var varRemoteEntry = varFilename ? {
      name: varFilename,
      path: '',
      type: 'module'
    } : undefined;
    // Process remotes
    var remotes = Array.from(Object.entries(getUsedRemotesMap())).flatMap(function (_ref2) {
      var remoteKey = _ref2[0],
        modules = _ref2[1];
      return Array.from(modules).map(function (moduleKey) {
        return {
          federationContainerName: options.remotes[remoteKey].entry,
          moduleName: moduleKey.replace(remoteKey, '').replace('/', ''),
          alias: remoteKey,
          entry: '*'
        };
      });
    });
    // Process shared dependencies
    var shared = Array.from(getUsedShares()).map(function (shareKey) {
      var shareItem = getNormalizeShareItem(shareKey);
      var assets = preloadMap[shareKey] || createEmptyAssetMap();
      return {
        id: name + ":" + shareKey,
        name: shareKey,
        version: shareItem.version,
        requiredVersion: shareItem.shareConfig.requiredVersion,
        assets: {
          js: {
            async: assets.js.async,
            sync: assets.js.sync
          },
          css: {
            async: assets.css.async,
            sync: assets.css.sync
          }
        }
      };
    }).filter(Boolean);
    // Process exposed modules
    var exposes = Object.entries(options.exposes).map(function (_ref3) {
      var key = _ref3[0],
        value = _ref3[1];
      var formatKey = key.replace('./', '');
      var sourceFile = value["import"];
      var assets = preloadMap[sourceFile] || createEmptyAssetMap();
      return {
        id: name + ":" + formatKey,
        name: formatKey,
        assets: {
          js: {
            async: assets.js.async,
            sync: assets.js.sync
          },
          css: {
            async: assets.css.async,
            sync: assets.css.sync
          }
        },
        path: key
      };
    }).filter(Boolean);
    return {
      id: name,
      name: name,
      metaData: _extends({
        name: name,
        type: 'app',
        buildInfo: {
          buildVersion: '1.0.0',
          buildName: name
        },
        remoteEntry: remoteEntry,
        ssrRemoteEntry: remoteEntry,
        varRemoteEntry: varRemoteEntry,
        types: {
          path: '',
          name: ''
        },
        globalName: name,
        pluginVersion: '0.2.5'
      }, !!getPublicPath ? {
        getPublicPath: getPublicPath
      } : {
        publicPath: publicPath
      }),
      shared: shared,
      remotes: remotes,
      exposes: exposes
    };
  }
};

var _resolve, _parseTimeout;
var promise = new Promise(function (resolve, reject) {
  _resolve = function _resolve(v) {
    clearTimeout(_parseTimeout);
    _parseTimeout = null;
    resolve(v);
  };
});
function setParseTimeout(timeout) {
  if (!_parseTimeout) {
    _parseTimeout = setTimeout(function () {
      console.warn("Parse timeout (" + timeout + "s) - forcing resolve");
      _resolve(1);
    }, timeout * 1000);
  }
}
var parsePromise = promise;
var exposesParseEnd = false;
var parseStartSet = new Set();
var parseEndSet = new Set();
function pluginModuleParseEnd (excludeFn, options) {
  setParseTimeout(options.moduleParseTimeout);
  return [{
    name: '_',
    apply: 'serve',
    config: function config() {
      // No waiting in development mode
      _resolve(1);
    }
  }, {
    enforce: 'pre',
    name: 'parseStart',
    apply: 'build',
    load: function load(id) {
      if (excludeFn(id)) {
        return;
      }
      parseStartSet.add(id);
    }
  }, {
    enforce: 'post',
    name: 'parseEnd',
    apply: 'build',
    moduleParsed: function moduleParsed(module) {
      var id = module.id;
      if (id === VIRTUAL_EXPOSES) {
        // When the entry JS file is empty and only contains exposes export code, it’s necessary to wait for the exposes modules to be resolved in order to collect the dependencies being used.
        exposesParseEnd = true;
      }
      if (excludeFn(id)) {
        return;
      }
      parseEndSet.add(id);
      if (exposesParseEnd && parseStartSet.size === parseEndSet.size) {
        _resolve(1);
      }
    }
  }];
}

var filter = createFilter();
function pluginProxyRemoteEntry () {
  var viteConfig, _command;
  return {
    name: 'proxyRemoteEntry',
    enforce: 'post',
    configResolved: function configResolved(config) {
      viteConfig = config;
    },
    config: function config(_config, _ref) {
      var command = _ref.command;
      _command = command;
    },
    resolveId: function resolveId(id, importer) {
      try {
        var _this = this;
        if (id === REMOTE_ENTRY_ID) {
          return Promise.resolve(REMOTE_ENTRY_ID);
        }
        if (id === VIRTUAL_EXPOSES) {
          return Promise.resolve(VIRTUAL_EXPOSES);
        }
        if (_command === 'serve' && id.includes(getHostAutoInitPath())) {
          return Promise.resolve(id);
        }
        // When the virtual remote entry imports a bare specifier (e.g. a runtime
        // plugin like "@module-federation/dts-plugin/dynamic-remote-type-hints-plugin"),
        // Vite cannot resolve it from the consumer project root under strict package
        // managers (pnpm) because it is a transitive dependency.  Re-resolve from
        // this package's location so Vite uses the correct ESM entry point.
        return Promise.resolve(function () {
          if (importer === REMOTE_ENTRY_ID && !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && !id.startsWith('virtual:')) {
            var importPath = typeof __filename === 'string' ? __filename : fileURLToPath(import.meta.url);
            return Promise.resolve(_this.resolve(id, __filename, {
              skipSelf: true
            })).then(function (resolved) {
              if (resolved) return resolved;
            });
          }
        }());
      } catch (e) {
        return Promise.reject(e);
      }
    },
    load: function load(id) {
      if (id === REMOTE_ENTRY_ID) {
        return parsePromise.then(function (_) {
          return generateRemoteEntry(getNormalizeModuleFederationOptions());
        });
      }
      if (id === VIRTUAL_EXPOSES) {
        return generateExposes();
      }
      if (_command === 'serve' && id.includes(getHostAutoInitPath())) {
        return id;
      }
    },
    transform: function transform(code, id) {
      var transformedCode = function () {
        if (!filter(id)) return;
        if (id.includes(REMOTE_ENTRY_ID)) {
          return parsePromise.then(function (_) {
            return generateRemoteEntry(getNormalizeModuleFederationOptions());
          });
        }
        if (id === VIRTUAL_EXPOSES) {
          return generateExposes();
        }
        if (id.includes(getHostAutoInitPath())) {
          var options = getNormalizeModuleFederationOptions();
          if (_command === 'serve') {
            var _viteConfig$server, _viteConfig$server2;
            var host = typeof ((_viteConfig$server = viteConfig.server) == null ? void 0 : _viteConfig$server.host) === 'string' && viteConfig.server.host !== '0.0.0.0' ? viteConfig.server.host : 'localhost';
            var publicPath = JSON.stringify(resolvePublicPath(options, viteConfig.base) + options.filename);
            return "\n          const origin = (window && " + !options.ignoreOrigin + ") ? window.origin : \"//" + host + ":" + ((_viteConfig$server2 = viteConfig.server) == null ? void 0 : _viteConfig$server2.port) + "\"\n          const remoteEntryPromise = await import(origin + " + publicPath + ")\n          // __tla only serves as a hack for vite-plugin-top-level-await.\n          Promise.resolve(remoteEntryPromise)\n          .then(remoteEntry => {\n            return Promise.resolve(remoteEntry.__tla)\n              .then(remoteEntry.init).catch(remoteEntry.init)\n          })\n          ";
          }
          return code;
        }
      }();
      return mapCodeToCodeWithSourcemap(transformedCode);
    }
  };
}

createFilter();
function pluginProxyRemotes (options) {
  var remotes = options.remotes;
  return {
    name: 'proxyRemotes',
    config: function config(_config, _ref) {
      var _command = _ref.command;
      Object.keys(remotes).forEach(function (key) {
        var remote = remotes[key];
        _config.resolve.alias.push({
          find: new RegExp("^(" + remote.name + "(/.*|$))"),
          replacement: '$1',
          customResolver: function customResolver(source) {
            var remoteModule = getRemoteVirtualModule(source, _command);
            addUsedRemote(remote.name, source);
            return remoteModule.getPath();
          }
        });
      });
    }
  };
}

/**
 * example:
 * const store = new PromiseStore<number>();
 * store.get("example").then((result) => {
 *  console.log("Result from example:", result); // 42
 * });
 * setTimeout(() => {
 *  store.set("example", Promise.resolve(42));
 * }, 2000);
 */
var PromiseStore = /*#__PURE__*/function () {
  function PromiseStore() {
    this.promiseMap = new Map();
    this.resolveMap = new Map();
  }
  var _proto = PromiseStore.prototype;
  _proto.set = function set(id, promise) {
    if (this.resolveMap.has(id)) {
      promise.then(this.resolveMap.get(id));
      this.resolveMap["delete"](id);
    }
    this.promiseMap.set(id, promise);
  };
  _proto.get = function get(id) {
    var _this = this;
    if (this.promiseMap.has(id)) {
      return this.promiseMap.get(id);
    }
    var pendingPromise = new Promise(function (resolve) {
      _this.resolveMap.set(id, resolve);
    });
    this.promiseMap.set(id, pendingPromise);
    return pendingPromise;
  };
  return PromiseStore;
}();

function proxySharedModule(options) {
  var _options$shared = options.shared,
    shared = _options$shared === void 0 ? {} : _options$shared;
  var _config;
  return [{
    name: 'generateLocalSharedImportMap',
    enforce: 'post',
    load: function load(id) {
      if (id.includes(getLocalSharedImportMapPath())) {
        return parsePromise.then(function (_) {
          return generateLocalSharedImportMap();
        });
      }
    },
    transform: function transform(_, id) {
      if (id.includes(getLocalSharedImportMapPath())) {
        return mapCodeToCodeWithSourcemap(parsePromise.then(function (_) {
          return generateLocalSharedImportMap();
        }));
      }
    }
  }, {
    name: 'proxyPreBuildShared',
    enforce: 'post',
    configResolved: function configResolved(config) {
      _config = config;
    },
    config: function config(_config2, _ref) {
      var _config2$resolve$alia, _config2$resolve$alia2;
      var command = _ref.command;
      (_config2$resolve$alia = _config2.resolve.alias).push.apply(_config2$resolve$alia, Object.keys(shared).map(function (key) {
        var pattern = key.endsWith('/') ? "(^" + key.replace(/\/$/, '') + "(/.+)?$)" : "(^" + key + "$)";
        return {
          // Intercept all shared requests and proxy them to loadShare
          find: new RegExp(pattern),
          replacement: '$1',
          customResolver: function customResolver(source, importer) {
            if (/\.css$/.test(source)) return;
            var loadSharePath = getLoadShareModulePath(source);
            writeLoadShareModule(source, shared[key], command);
            writePreBuildLibPath(source);
            addUsedShares(source);
            writeLocalSharedImportMap();
            return this.resolve(loadSharePath, importer);
          }
        };
      }));
      var savePrebuild = new PromiseStore();
      (_config2$resolve$alia2 = _config2.resolve.alias).push.apply(_config2$resolve$alia2, Object.keys(shared).map(function (key) {
        return command === 'build' ? {
          find: new RegExp("(.*" + PREBUILD_TAG + ".*)"),
          replacement: function replacement($1) {
            var module = assertModuleFound(PREBUILD_TAG, $1);
            var pkgName = module.name;
            return pkgName;
          }
        } : {
          find: new RegExp("(.*" + PREBUILD_TAG + ".*)"),
          replacement: '$1',
          customResolver: function customResolver(source, importer) {
            try {
              var _this = this;
              var module = assertModuleFound(PREBUILD_TAG, source);
              var pkgName = module.name;
              return Promise.resolve(_this.resolve(pkgName, importer).then(function (item) {
                return item.id;
              })).then(function (result) {
                if (!result.includes(_config.cacheDir)) {
                  // save pre-bunding module id
                  savePrebuild.set(pkgName, Promise.resolve(result));
                }
                // Fix localSharedImportMap import id
                var _resolve = _this.resolve;
                return Promise.resolve(savePrebuild.get(pkgName)).then(function (_savePrebuild$get) {
                  return Promise.resolve(_resolve.call(_this, _savePrebuild$get, importer));
                });
              });
            } catch (e) {
              return Promise.reject(e);
            }
          }
        };
      }));
    }
  }];
}

var VarRemoteEntry = function VarRemoteEntry() {
  var mfOptions = getNormalizeModuleFederationOptions();
  var name = mfOptions.name,
    varFilename = mfOptions.varFilename,
    filename = mfOptions.filename;
  var viteConfig;
  return [{
    name: 'module-federation-var-remote-entry',
    apply: 'serve',
    /**
     * Stores resolved Vite config for later use
     */
    /**
     * Finalizes configuration after all plugins are resolved
     * @param config - Fully resolved Vite config
     */
    configResolved: function configResolved(config) {
      viteConfig = config;
    },
    /**
     * Configures dev server middleware to handle varRemoteEntry requests
     * @param server - Vite dev server instance
     */
    configureServer: function configureServer(server) {
      server.middlewares.use(function (req, res, next) {
        var _req$url;
        if (!varFilename) {
          next();
          return;
        }
        if (((_req$url = req.url) == null ? void 0 : _req$url.replace(/\?.*/, '')) === (viteConfig.base + varFilename).replace(/^\/?/, '/')) {
          res.setHeader('Content-Type', 'text/javascript');
          res.setHeader('Access-Control-Allow-Origin', '*');
          console.log({
            filename: filename
          });
          res.end(generateVarRemoteEntry(filename));
        } else {
          next();
        }
      });
    }
  }, {
    name: 'module-federation-var-remote-entry',
    enforce: 'post',
    /**
     * Initial plugin configuration
     * @param config - Vite config object
     * @param command - Current Vite command (serve/build)
     */
    config: function config(_config, _ref) {
      if (!_config.build) _config.build = {};
    },
    /**
     * Generates the module federation "var" remote entry file
     * @param options - Rollup output options
     * @param bundle - Generated bundle assets
     */
    generateBundle: function generateBundle(options, bundle) {
      try {
        var _this = this;
        if (!varFilename) return Promise.resolve();
        var isValidName = isValidVarName(name);
        if (!isValidName) {
          viteConfig.logger.warn("Provided remote name \"" + name + "\" is not valid for \"var\" remoteEntry type, thus it's placed in globalThis['" + name + "'].\nIt may cause problems, so you would better want to use valid var name (see https://www.w3schools.com/js/js_variables.asp).");
        }
        var remoteEntryFile = findRemoteEntryFile(mfOptions.filename, bundle);
        if (!remoteEntryFile) throw new Error("Couldn't find a remoteEntry chunk file for " + mfOptions.filename + ", can't generate varRemoteEntry file");
        _this.emitFile({
          type: 'asset',
          fileName: varFilename,
          source: generateVarRemoteEntry(remoteEntryFile)
        });
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }];
  function isValidVarName(name) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
  }
  /**
   * Generates the final "var" remote entry file
   * @param remoteEntryFile - Path to esm remote entry file
   * @returns Complete "var" remoteEntry.js file source
   */
  function generateVarRemoteEntry(remoteEntryFile) {
    var options = getNormalizeModuleFederationOptions();
    var name = options.name,
      varFilename = options.varFilename;
    var isValidName = isValidVarName(name);
    // todo: implement publicPath/getPublicPath support
    return "\n  " + (isValidName ? "var " + name + ";" : '') + "\n  " + (isValidName ? name : "globalThis['" + name + "']") + " = (function () {\n    function getScriptUrl() {\n      const currentScript = document.currentScript;\n      if (!currentScript) {\n        console.error(\"[VarRemoteEntry] " + varFilename + " script should be called from sync <script> tag (document.currentScript is undefined)\")\n        return '/';\n      }\n      return document.currentScript.src.replace(/\\/[^/]*$/, '/');\n    }\n\n    const entry = getScriptUrl() + '" + remoteEntryFile + "';\n\n    return {\n      get: (...args) => import(entry).then(m => m.get(...args)),\n      init: (...args) => import(entry).then(m => m.init(...args)),\n    };\n  })();\n  ";
  }
};

var aliasToArrayPlugin = {
  name: 'alias-transform-plugin',
  config: function config(_config, _ref) {
    if (!_config.resolve) _config.resolve = {};
    if (!_config.resolve.alias) _config.resolve.alias = [];
    var alias = _config.resolve.alias;
    if (typeof alias === 'object' && !Array.isArray(alias)) {
      _config.resolve.alias = Object.entries(alias).map(function (_ref2) {
        var find = _ref2[0],
          replacement = _ref2[1];
        return {
          find: find,
          replacement: replacement
        };
      });
    }
  }
};

var normalizeOptimizeDepsPlugin = {
  name: 'normalizeOptimizeDeps',
  config: function config(_config, _ref) {
    var optimizeDeps = _config.optimizeDeps;
    if (!optimizeDeps) {
      _config.optimizeDeps = {};
      optimizeDeps = _config.optimizeDeps;
    }
    // todo: fix this workaround
    optimizeDeps.force = true;
    if (!optimizeDeps.include) optimizeDeps.include = [];
    if (!optimizeDeps.needsInterop) optimizeDeps.needsInterop = [];
  }
};

function federation(mfUserOptions) {
  var options = normalizeModuleFederationOptions(mfUserOptions);
  var name = options.name,
    shared = options.shared,
    filename = options.filename,
    hostInitInjectLocation = options.hostInitInjectLocation;
  if (!name) throw new Error('name is required');
  return [{
    name: 'vite:module-federation-config',
    enforce: 'pre',
    configResolved: function configResolved(config) {
      // Set root path
      VirtualModule.setRoot(config.root);
      // Ensure virtual package directory exists
      VirtualModule.ensureVirtualPackageExists();
      initVirtualModules();
    }
  }, aliasToArrayPlugin, checkAliasConflicts({
    shared: shared
  }), normalizeOptimizeDepsPlugin].concat(pluginDts(options), addEntry({
    entryName: 'remoteEntry',
    entryPath: REMOTE_ENTRY_ID,
    fileName: filename
  }), addEntry({
    entryName: 'hostInit',
    entryPath: getHostAutoInitPath(),
    inject: hostInitInjectLocation
  }), addEntry({
    entryName: 'virtualExposes',
    entryPath: VIRTUAL_EXPOSES
  }), [pluginProxyRemoteEntry(), pluginProxyRemotes(options)], pluginModuleParseEnd(function (id) {
    return id.includes(getHostAutoInitImportId()) || id.includes(REMOTE_ENTRY_ID) || id.includes(VIRTUAL_EXPOSES) || id.includes(getLocalSharedImportMapPath());
  }, {
    moduleParseTimeout: options.moduleParseTimeout
  }), proxySharedModule({
    shared: shared
  }), [PluginDevProxyModuleTopLevelAwait(), {
    name: 'module-federation-vite',
    enforce: 'post',
    // @ts-expect-error
    // used to expose plugin options: https://github.com/rolldown/rolldown/discussions/2577#discussioncomment-11137593
    _options: options,
    config: function config(_config, _ref) {
      var _config$optimizeDeps, _config$optimizeDeps2, _config$optimizeDeps3, _config$optimizeDeps4;
      // TODO: singleton
      _config.resolve.alias.push({
        find: '@module-federation/runtime',
        replacement: options.implementation
      });
      _config.build = defu(_config.build || {}, {
        commonjsOptions: {
          strictRequires: 'auto'
        }
      });
      var virtualDir = options.virtualModuleDir || '__mf__virtual';
      (_config$optimizeDeps = _config.optimizeDeps) == null || (_config$optimizeDeps = _config$optimizeDeps.include) == null || _config$optimizeDeps.push('@module-federation/runtime');
      (_config$optimizeDeps2 = _config.optimizeDeps) == null || (_config$optimizeDeps2 = _config$optimizeDeps2.include) == null || _config$optimizeDeps2.push(virtualDir);
      (_config$optimizeDeps3 = _config.optimizeDeps) == null || (_config$optimizeDeps3 = _config$optimizeDeps3.needsInterop) == null || _config$optimizeDeps3.push(virtualDir);
      (_config$optimizeDeps4 = _config.optimizeDeps) == null || (_config$optimizeDeps4 = _config$optimizeDeps4.needsInterop) == null || _config$optimizeDeps4.push(getLocalSharedImportMapPath());
    }
  }], Manifest(), VarRemoteEntry());
}

export { federation };
