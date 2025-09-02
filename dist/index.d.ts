/**
 * Initialize Pyodide runtime and packages in advance
 * This is optional - the runtime will be initialized automatically when needed,
 * but calling this function early can reduce latency for the first processing call
 * @returns Promise that resolves when initialization is complete
 */
export declare function initializePyodide(): Promise<void>;
/**
 * Add a progress callback function to receive updates during initialization and processing
 * @param fn - Callback function that receives stage name, progress percentage (0-100), and optional message
 */
export declare function addProgressCallback(fn: (stage: string, progress: number, message?: string) => void): void;
/**
 * Remove the progress callback
 */
export declare function removeProgressCallback(): void;
/**
 * Enable or disable verbose logging
 * @param verbose - Whether to enable verbose logging
 */
export declare function setVerboseLogging(verbose: boolean): void;
/**
 * Check if verbose logging is enabled
 * @returns Whether verbose logging is enabled
 */
export declare function isVerboseLogging(): boolean;
/**
 * Performs closed-form alpha matting on a single image with trimap encoded in alpha channel
 * @param imageData - ImageData from canvas containing the source image with trimap in alpha channel:
 *   - RGB channels: Original image colors
 *   - Alpha channel: Trimap where 0=background, 255=foreground, 128=unknown (to be solved)
 * @param maxDimension - Maximum dimension (width or height) for processing. Images larger than this will be downscaled for processing and then upscaled back. Default: 1024
 * @returns ImageData containing the RGBA result image (with foreground colors and computed alpha)
 */
export declare function closedFormMatting(imageData: ImageData, maxDimension?: number): Promise<ImageData>;
/**
 * Terminate the web worker (useful for cleanup)
 */
export declare function terminateWorker(): void;
/**
 * Clean up resources and reset state
 */
export declare function cleanup(): void;
