import { PyodideInterface } from 'pyodide';
/**
 * Calls Pyodide to execute Python code that prints "Hello World"
 */
export declare function callPyodide(): Promise<void>;
export interface MattingResult {
    alpha: ImageData;
    foreground: ImageData;
}
/**
 * Performs closed-form alpha matting on multiple images with trimaps and returns RGBA images
 * @param imageData - Array of ImageData from canvas containing the source images
 * @param trimapData - Array of ImageData from canvas containing the trimaps
 * @returns Array of ImageData containing the RGBA result images (with foreground colors and alpha)
 */
export declare function closedFormMatting(imageData: ImageData[], trimapData: ImageData[]): Promise<ImageData[]>;
/**
 * Get the Pyodide instance (useful for advanced usage)
 */
export declare function getPyodideInstance(): Promise<PyodideInterface>;
