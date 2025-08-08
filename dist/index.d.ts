import { PyodideInterface } from 'pyodide';
/**
 * Calls Pyodide to execute Python code that prints "Hello World"
 */
export declare function callPyodide(): Promise<void>;
/**
 * Performs closed-form alpha matting on an image with a trimap
 * @param imageData - ImageData from canvas containing the source image
 * @param trimapData - ImageData from canvas containing the trimap
 * @returns ImageData containing the alpha matte
 */
export declare function closedFormMatting(imageData: ImageData, trimapData: ImageData): Promise<ImageData>;
/**
 * Get the Pyodide instance (useful for advanced usage)
 */
export declare function getPyodideInstance(): Promise<PyodideInterface>;
