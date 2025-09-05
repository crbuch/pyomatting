export interface PyomattingIMData {
    data: Uint8Array;
    width: number;
    height: number;
    channels: number;
}
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
 * Performs closed-form alpha matting exactly like rembg's alpha_matting_cutout function
 * @param imageData - PyomattingIMData containing RGB image (3 channels)
 * @param trimapData - PyomattingIMData containing trimap/mask (1 channel) - direct U^2-Net output
 * @returns PyomattingIMData containing RGBA result (4 channels) with background removed and alpha matted
 */
export declare function closedFormMatting(imageData: PyomattingIMData, trimapData: PyomattingIMData): Promise<PyomattingIMData>;
/**
 * Terminate the web worker (useful for cleanup)
 */
export declare function terminateWorker(): void;
/**
 * Clean up resources and reset state
 */
export declare function cleanup(): void;
