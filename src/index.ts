import { loadPyodide, PyodideInterface } from 'pyodide';

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
    
    // Install the closed-form matting Python code
    pyodideInstance.runPython(`
import numpy as np
import scipy.sparse
import scipy.sparse.linalg
import cv2
from numpy.lib.stride_tricks import as_strided

def _rolling_block(A, block=(3, 3)):
    """Applies sliding window to given matrix."""
    shape = (A.shape[0] - block[0] + 1, A.shape[1] - block[1] + 1) + block
    strides = (A.strides[0], A.strides[1]) + A.strides
    return as_strided(A, shape=shape, strides=strides)

def compute_laplacian(img, mask=None, eps=1e-7, win_rad=1):
    """Computes Matting Laplacian for a given image."""
    win_size = (win_rad * 2 + 1) ** 2
    h, w, d = img.shape
    c_h, c_w = h - 2 * win_rad, w - 2 * win_rad
    win_diam = win_rad * 2 + 1

    indsM = np.arange(h * w).reshape((h, w))
    ravelImg = img.reshape(h * w, d)
    win_inds = _rolling_block(indsM, block=(win_diam, win_diam))

    win_inds = win_inds.reshape(c_h, c_w, win_size)
    if mask is not None:
        mask = cv2.dilate(
            mask.astype(np.uint8),
            np.ones((win_diam, win_diam), np.uint8)
        ).astype(bool)
        win_mask = np.sum(mask.ravel()[win_inds], axis=2)
        win_inds = win_inds[win_mask > 0, :]
    else:
        win_inds = win_inds.reshape(-1, win_size)

    winI = ravelImg[win_inds]
    win_mu = np.mean(winI, axis=1, keepdims=True)
    win_var = np.einsum('...ji,...jk ->...ik', winI, winI) / win_size - np.einsum('...ji,...jk ->...ik', win_mu, win_mu)

    A = win_var + (eps/win_size)*np.eye(3)
    B = (winI - win_mu).transpose(0, 2, 1)
    X = np.linalg.solve(A, B).transpose(0, 2, 1)
    vals = np.eye(win_size) - (1.0/win_size)*(1 + X @ B)

    nz_indsCol = np.tile(win_inds, win_size).ravel()
    nz_indsRow = np.repeat(win_inds, win_size).ravel()
    nz_indsVal = vals.ravel()
    
    L = scipy.sparse.coo_matrix((nz_indsVal, (nz_indsRow, nz_indsCol)), shape=(h*w, h*w))
    return L

def closed_form_matting_with_prior(image, prior, prior_confidence, consts_map=None):
    """Applies closed form matting with prior alpha map to image."""
    assert image.shape[:2] == prior.shape, 'prior must be 2D matrix with height and width equal to image.'
    assert image.shape[:2] == prior_confidence.shape, 'prior_confidence must be 2D matrix with height and width equal to image.'
    assert (consts_map is None) or image.shape[:2] == consts_map.shape, 'consts_map must be 2D matrix with height and width equal to image.'
    
    laplacian = compute_laplacian(image, ~consts_map if consts_map is not None else None)
    confidence = scipy.sparse.diags(prior_confidence.ravel())
    solution = scipy.sparse.linalg.spsolve(
        laplacian + confidence,
        prior.ravel() * prior_confidence.ravel()
    )
    alpha = np.minimum(np.maximum(solution.reshape(prior.shape), 0), 1)
    return alpha

def closed_form_matting_with_trimap(image, trimap, trimap_confidence=100.0):
    """Apply Closed-Form matting to given image using trimap."""
    assert image.shape[:2] == trimap.shape, 'trimap must be 2D matrix with height and width equal to image.'
    consts_map = (trimap < 0.1) | (trimap > 0.9)
    return closed_form_matting_with_prior(image, trimap, trimap_confidence * consts_map, consts_map)

# Global variable to store the result
alpha_result = None
    `);
    
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
    
    // Execute the matting algorithm
    pyodide.runPython(`
# Convert image data to numpy array
image_array = np.array(image_data, dtype=np.uint8)
image_rgba = image_array.reshape((height, width, 4))
image_rgb = image_rgba[:, :, :3].astype(np.float32) / 255.0

# Convert trimap data to numpy array  
trimap_array = np.array(trimap_data, dtype=np.uint8)
trimap_rgba = trimap_array.reshape((height, width, 4))
trimap_gray = np.mean(trimap_rgba[:, :, :3], axis=2).astype(np.float32) / 255.0

print(f"Image shape: {image_rgb.shape}")
print(f"Trimap shape: {trimap_gray.shape}")

# Perform closed-form matting
try:
    alpha_result = closed_form_matting_with_trimap(image_rgb, trimap_gray)
    print(f"Alpha result shape: {alpha_result.shape}")
    print(f"Alpha range: {alpha_result.min():.3f} to {alpha_result.max():.3f}")
except Exception as e:
    print(f"Error in matting: {e}")
    import traceback
    traceback.print_exc()
    alpha_result = trimap_gray  # Fallback to trimap

# Convert result to list for JavaScript
alpha_list = alpha_result.flatten().tolist()
    `);
    
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
