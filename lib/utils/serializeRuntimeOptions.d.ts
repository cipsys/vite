/**
 * Serializes a JavaScript object into a string of source code that can be evaluated.
 * This function is used to create runtime plugin options without relying solely on JSON.stringify,
 * allowing support for non-JSON types like RegExp, Date, Map, Set, and Functions.
 * It also safely handles circular references.
 *
 * @param {Record<string, unknown>} options - The options object to serialize.
 * @returns {string} The resulting JavaScript source code string.
 */
export declare function serializeRuntimeOptions(options: Record<string, unknown>): string;
