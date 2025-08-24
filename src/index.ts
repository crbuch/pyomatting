// Import worker as inline module - this creates a Blob URL that works in any environment
import PyWorker from './pyodide.worker.ts?worker&inline&module';

// Worker message types
interface WorkerMessage {
  type: 'process_matting';
  data: {
    imageData: number[][];
    trimapData: number[][];
    widths: number[];
    heights: number[];
  };
}

interface WorkerResponse {
  type: 'matting_complete' | 'matting_error' | 'init_progress';
  data?: {
    batchAlphaLists: number[][];
    batchForegroundLists: number[][];
  };
  error?: string;
  progress?: {
    stage: string;
    message: string;
  };
}

// Global worker instance
let worker: Worker | null = null;

/**
 * Initialize the web worker if not already initialized
 */
function initializeWorker(): Worker {
  if (!worker) {
    worker = new PyWorker(); // Worker is already module-type from &module
  }
  return worker!; // We know it's not null after the check above
}

/**
 * Process matting in web worker and wait for initialization if needed
 */
async function processInWorker(imageData: number[][], trimapData: number[][], widths: number[], heights: number[]): Promise<{ batchAlphaLists: number[][], batchForegroundLists: number[][] }> {
  return new Promise((resolve, reject) => {
    const worker = initializeWorker();
    
    const handleMessage = (evt: MessageEvent<WorkerResponse>) => {
      switch (evt.data.type) {
        case 'init_progress':
          console.log(`${evt.data.progress?.stage}: ${evt.data.progress?.message}`);
          break;
        case 'matting_complete':
          worker.removeEventListener('message', handleMessage);
          resolve(evt.data.data!);
          break;
        case 'matting_error':
          worker.removeEventListener('message', handleMessage);
          reject(new Error(evt.data.error));
          break;
      }
    };
    
    worker.addEventListener('message', handleMessage);
    
    // Send processing request
    worker.postMessage({
      type: 'process_matting',
      data: { imageData, trimapData, widths, heights }
    } as WorkerMessage);
  });
}

/**
 * Performs closed-form alpha matting on multiple images with trimaps and returns RGBA images
 * @param imageData - Array of ImageData from canvas containing the source images
 * @param trimapData - Array of ImageData from canvas containing the trimaps
 * @returns Array of ImageData containing the RGBA result images (with foreground colors and alpha)
 */
export async function closedFormMatting(imageData: ImageData[], trimapData: ImageData[]): Promise<ImageData[]> {
  try {
    if (imageData.length !== trimapData.length) {
      throw new Error('Number of images and trimaps must match');
    }
    
    if (imageData.length === 0) {
      throw new Error('At least one image is required');
    }
    
    // Convert all ImageData to regular JavaScript arrays
    const batchImageData = imageData.map(img => Array.from(img.data));
    const batchTrimapData = trimapData.map(trimap => Array.from(trimap.data));
    const batchWidths = imageData.map(img => img.width);
    const batchHeights = imageData.map(img => img.height);
    
    console.log(`Processing ${imageData.length} images in batch using web worker`);

    // Process in web worker
    const { batchAlphaLists, batchForegroundLists } = await processInWorker(
      batchImageData, 
      batchTrimapData, 
      batchWidths, 
      batchHeights
    );
    
    // Convert back to ImageData array
    const results: ImageData[] = [];
    
    for (let batchIdx = 0; batchIdx < imageData.length; batchIdx++) {
      const alphaList = batchAlphaLists[batchIdx];
      const foregroundList = batchForegroundLists[batchIdx];
      const width = imageData[batchIdx].width;
      const height = imageData[batchIdx].height;
      
      // Create RGBA ImageData with foreground colors and alpha
      const rgbaData = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        const alphaValue = Math.round(alphaList[i] * 255);
        const baseIndex = i * 4;
        const fgBaseIndex = i * 3;
        
        // RGB from foreground, alpha from alpha matte
        rgbaData[baseIndex] = Math.round(foregroundList[fgBaseIndex] * 255);     // R
        rgbaData[baseIndex + 1] = Math.round(foregroundList[fgBaseIndex + 1] * 255); // G  
        rgbaData[baseIndex + 2] = Math.round(foregroundList[fgBaseIndex + 2] * 255); // B
        rgbaData[baseIndex + 3] = alphaValue; // A
      }
      
      results.push(new ImageData(rgbaData, width, height));
    }
    
    return results;
    
  } catch (error) {
    console.error('Error in closed-form matting:', error);
    throw error;
  }
}

/**
 * Terminate the web worker (useful for cleanup)
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
