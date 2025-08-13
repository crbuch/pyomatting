import { loadPyodide, PyodideInterface } from 'pyodide';
import laplacianCode from './python/laplacian.py';
import mattingCode from './python/matting.py';
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
    
    console.log('Pyodide loaded successfully!');
  }
  return pyodideInstance;
}

/**
 * Calls Pyodide to execute Python code that prints "Hello World"
 */
export async function callPyodide(): Promise<void> {
  try {
    const pyodide = await initializePyodide();
    
    // Python code to print "Hello World"
    const pythonCode = `
print("Hello World")
    `;
    
    // Execute the Python code
    pyodide.runPython(pythonCode);
    
  } catch (error) {
    console.error('Error calling Pyodide:', error);
    throw error;
  }
}

/**
 * Performs closed-form alpha matting on multiple images with trimaps
 * @param imageData - Array of ImageData from canvas containing the source images
 * @param trimapData - Array of ImageData from canvas containing the trimaps
 * @returns Array of ImageData containing the alpha mattes
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
    
    // Get the results back as a list of lists
    const batchAlphaLists = pyodide.globals.get('batch_alpha_lists');
    
    // Convert back to ImageData array
    const results: ImageData[] = [];
    
    for (let batchIdx = 0; batchIdx < imageData.length; batchIdx++) {
      const alphaList = batchAlphaLists[batchIdx];
      const width = imageData[batchIdx].width;
      const height = imageData[batchIdx].height;
      const resultData = new Uint8ClampedArray(width * height * 4);
      
      for (let i = 0; i < width * height; i++) {
        const alphaValue = Math.round(alphaList[i] * 255);
        const baseIndex = i * 4;
        
        // Set RGB to white and alpha to the computed value
        resultData[baseIndex] = 255;     // R
        resultData[baseIndex + 1] = 255; // G  
        resultData[baseIndex + 2] = 255; // B
        resultData[baseIndex + 3] = alphaValue; // A
      }
      
      results.push(new ImageData(resultData, width, height));
    }
    
    return results;
    
  } catch (error) {
    console.error('Error in closed-form matting:', error);
    throw error;
  }
}

/**
 * Get the Pyodide instance (useful for advanced usage)
 */
export async function getPyodideInstance(): Promise<PyodideInterface> {
  return await initializePyodide();
}
