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
 * Performs closed-form alpha matting on an image with a trimap
 * @param imageData - ImageData from canvas containing the source image
 * @param trimapData - ImageData from canvas containing the trimap
 * @returns ImageData containing the alpha matte
 */
export async function closedFormMatting(imageData: ImageData, trimapData: ImageData): Promise<ImageData> {
  try {
    const pyodide = await initializePyodide();
    
    // Convert ImageData to regular JavaScript arrays
    const imageArray = Array.from(imageData.data);
    const trimapArray = Array.from(trimapData.data);
    
    // Set the image data in Python
    pyodide.globals.set("image_data", imageArray);
    pyodide.globals.set("trimap_data", trimapArray);
    pyodide.globals.set("width", imageData.width);
    pyodide.globals.set("height", imageData.height);
    
    // Execute the matting algorithm using the imported Python code
    pyodide.runPython(processMattingCode);
    
    // Get the result back as a list
    const alphaList = pyodide.globals.get('alpha_list');
    
    // Convert back to ImageData
    const resultData = new Uint8ClampedArray(imageData.width * imageData.height * 4);
    
    for (let i = 0; i < imageData.width * imageData.height; i++) {
      const alphaValue = Math.round(alphaList[i] * 255);
      const baseIndex = i * 4;
      
      // Set RGB to white and alpha to the computed value
      resultData[baseIndex] = 255;     // R
      resultData[baseIndex + 1] = 255; // G  
      resultData[baseIndex + 2] = 255; // B
      resultData[baseIndex + 3] = alphaValue; // A
    }
    
    return new ImageData(resultData, imageData.width, imageData.height);
    
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
