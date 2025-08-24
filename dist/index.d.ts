/**
 * Performs closed-form alpha matting on multiple images with trimaps and returns RGBA images
 * @param imageData - Array of ImageData from canvas containing the source images
 * @param trimapData - Array of ImageData from canvas containing the trimaps
 * @returns Array of ImageData containing the RGBA result images (with foreground colors and alpha)
 */
export declare function closedFormMatting(imageData: ImageData[], trimapData: ImageData[]): Promise<ImageData[]>;
/**
 * Terminate the web worker (useful for cleanup)
 */
export declare function terminateWorker(): void;
