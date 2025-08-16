import { loadPyodide, PyodideInterface } from 'pyodide';
import laplacianCode from './python/laplacian.py';
import mattingCode from './python/matting.py';
import foregroundBackgroundCode from './python/foreground_background.py';
import processMattingCode from './python/process_matting.py';

let pyodideInstance: PyodideInterface | null = null;

/**
 * Initialize Pyodide if not already initialized
 */
async function initializePyodide(): Promise<PyodideInterface> {
  if (!pyodideInstance) {
    console.log('Loading Pyodide...');
    pyodideInstance = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
    });
    
    console.log('Installing required packages...');
    await pyodideInstance.loadPackage(['numpy', 'scipy', 'opencv-python']);
    
    console.log('Loading Python modules...');
    
    // Load laplacian computation functions
    pyodideInstance.runPython(laplacianCode);
    
    // Load matting algorithms  
    pyodideInstance.runPython(mattingCode);
    
    // Load foreground/background estimation
    pyodideInstance.runPython(foregroundBackgroundCode);
    
    console.log('Pyodide loaded successfully!');
  }
  return pyodideInstance;
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
    
    const pyodide = await initializePyodide();
    
    // Convert all ImageData to regular JavaScript arrays
    const batchImageData = imageData.map(img => Array.from(img.data));
    const batchTrimapData = trimapData.map(trimap => Array.from(trimap.data));
    const batchWidths = imageData.map(img => img.width);
    const batchHeights = imageData.map(img => img.height);
    
    // Set the batch data in Python
    pyodide.globals.set("batch_image_data", batchImageData);
    pyodide.globals.set("batch_trimap_data", batchTrimapData);
    pyodide.globals.set("batch_widths", batchWidths);
    pyodide.globals.set("batch_heights", batchHeights);
    
    // Execute the batch matting algorithm using the imported Python code
    pyodide.runPython(processMattingCode);
    
    // Get the results back as lists
    const batchAlphaLists = pyodide.globals.get('batch_alpha_lists');
    const batchForegroundLists = pyodide.globals.get('batch_foreground_lists');
    
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
