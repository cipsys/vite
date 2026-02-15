import type { Plugin } from 'vite';
import { NormalizedShared } from '../utils/normalizeModuleFederationOptions';
/**
 * Check if user-defined alias conflicts with shared modules
 * This should run after aliasToArrayPlugin to ensure alias is an array
 */
export declare function checkAliasConflicts(options: {
    shared?: NormalizedShared;
}): Plugin;
