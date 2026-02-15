import { SharedConfig, ShareStrategy } from '@module-federation/runtime/types';
import type { sharePlugin } from '@module-federation/sdk';
export type RemoteEntryType = 'var' | 'module' | 'assign' | 'assign-properties' | 'this' | 'window' | 'self' | 'global' | 'commonjs' | 'commonjs2' | 'commonjs-module' | 'commonjs-static' | 'amd' | 'amd-require' | 'umd' | 'umd2' | 'jsonp' | 'system' | string;
interface ExposesItem {
    import: string;
}
export interface NormalizedShared {
    [key: string]: ShareItem;
}
export interface RemoteObjectConfig {
    type?: string;
    name: string;
    entry: string;
    entryGlobalName?: string;
    shareScope?: string;
}
export declare function normalizeRemotes(remotes: Record<string, string | RemoteObjectConfig> | undefined): Record<string, RemoteObjectConfig>;
export interface ShareItem {
    name: string;
    version: string | undefined;
    scope: string;
    from: string;
    shareConfig: SharedConfig & sharePlugin.SharedConfig;
}
interface ManifestOptions {
    filePath?: string;
    disableAssetsAnalyze?: boolean;
    fileName?: string;
}
export type ModuleFederationOptions = {
    exposes?: Record<string, string | {
        import: string;
    }> | undefined;
    filename?: string;
    library?: any;
    name: string;
    remotes?: Record<string, string | RemoteObjectConfig> | undefined;
    runtime?: any;
    shareScope?: string;
    /**
     * Override the public path used for remote entries
     * Defaults to Vite's base config or "auto" if base is empty
     */
    publicPath?: string;
    /**
     * Controls whether all CSS assets from the bundle should be added to every exposed module.
     * When false (default), the plugin will not process any CSS assets.
     * When true, all CSS assets are bundled into every exposed module.
     */
    bundleAllCSS?: boolean;
    shared?: string[] | Record<string, string | {
        name?: string;
        version?: string;
        shareScope?: string;
        singleton?: boolean;
        requiredVersion?: string;
        strictVersion?: boolean;
        import?: sharePlugin.SharedConfig['import'];
    }> | undefined;
    runtimePlugins?: Array<string | [string, Record<string, unknown>]>;
    getPublicPath?: string;
    implementation?: string;
    manifest?: ManifestOptions | boolean;
    dev?: boolean | PluginDevOptions;
    dts?: boolean | PluginDtsOptions;
    shareStrategy?: ShareStrategy;
    ignoreOrigin?: boolean;
    virtualModuleDir?: string;
    hostInitInjectLocation?: HostInitInjectLocationOptions;
    /**
     * Timeout for parsing modules in seconds.
     * Defaults to 10 seconds.
     */
    moduleParseTimeout?: number;
    /**
     * Allows generate additional remoteEntry file for "var" host environment
     */
    varFilename?: string;
};
export interface NormalizedModuleFederationOptions {
    exposes: Record<string, ExposesItem>;
    filename: string;
    library: any;
    name: string;
    remotes: Record<string, RemoteObjectConfig>;
    runtime: any;
    shareScope: string;
    shared: NormalizedShared;
    runtimePlugins: Array<string | [string, Record<string, unknown>]>;
    implementation: string;
    manifest: ManifestOptions | boolean;
    dev?: boolean | PluginDevOptions;
    dts?: boolean | PluginDtsOptions;
    shareStrategy: ShareStrategy;
    getPublicPath?: string;
    publicPath?: string;
    ignoreOrigin?: boolean;
    virtualModuleDir: string;
    hostInitInjectLocation: HostInitInjectLocationOptions;
    /**
     * Controls whether all CSS assets from the bundle should be added to every exposed module.
     * When false (default), the plugin will not process any CSS assets.
     * When true, all CSS assets are bundled into every exposed module.
     */
    bundleAllCSS: boolean;
    moduleParseTimeout: number;
    varFilename?: string;
}
type HostInitInjectLocationOptions = 'entry' | 'html';
interface PluginDevOptions {
    disableLiveReload?: boolean;
    disableHotTypesReload?: boolean;
    disableDynamicRemoteTypeHints?: boolean;
}
interface RemoteTypeUrl {
    alias?: string;
    api: string;
    zip: string;
}
interface RemoteTypeUrls {
    [remoteName: string]: RemoteTypeUrl;
}
interface PluginDtsOptions {
    generateTypes?: boolean | DtsRemoteOptions;
    consumeTypes?: boolean | DtsHostOptions;
    tsConfigPath?: string;
    extraOptions?: Record<string, unknown>;
    implementation?: string;
    cwd?: string;
    displayErrorInTerminal?: boolean;
}
interface DtsRemoteOptions {
    tsConfigPath?: string;
    typesFolder?: string;
    compiledTypesFolder?: string;
    deleteTypesFolder?: boolean;
    additionalFilesToCompile?: string[];
    compilerInstance?: 'tsc' | 'vue-tsc' | 'tspc' | string;
    compileInChildProcess?: boolean;
    generateAPITypes?: boolean;
    extractThirdParty?: boolean | {
        exclude?: Array<string | RegExp>;
    };
    extractRemoteTypes?: boolean;
    abortOnError?: boolean;
    deleteTsConfig?: boolean;
}
interface DtsHostOptions {
    typesFolder?: string;
    abortOnError?: boolean;
    remoteTypesFolder?: string;
    deleteTypesFolder?: boolean;
    maxRetries?: number;
    consumeAPITypes?: boolean;
    runtimePkgs?: string[];
    remoteTypeUrls?: (() => Promise<RemoteTypeUrls>) | RemoteTypeUrls;
    timeout?: number;
    family?: 4 | 6;
    typesOnBuild?: boolean;
}
export declare function getNormalizeModuleFederationOptions(): NormalizedModuleFederationOptions;
export declare function getNormalizeShareItem(key: string): ShareItem;
export declare function normalizeModuleFederationOptions(options: ModuleFederationOptions): NormalizedModuleFederationOptions;
export {};
