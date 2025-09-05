# Pyomatting

A TypeScript package that implements closed-form alpha matting using Pyodide to run Python algorithms in the browser. This package brings the power of the closed-form matting algorithm from [MarcoForte/closed-form-matting](https://github.com/MarcoForte/closed-form-matting) to web browsers via WebAssembly with optimized memory usage through TypedArrays and efficient data transfer.

## Features

- 🎭 **Closed-Form Alpha Matting**: State-of-the-art alpha matting algorithm based on Levin et al. (2007)
- 🐍 **Python in the Browser**: Leverages Pyodide to run NumPy, SciPy, and OpenCV in WebAssembly
- 📦 **TypeScript Support**: Full type definitions and modern ES modules
- 🛠️ **Modular Architecture**: Clean separation of Python algorithms in separate files
- ⚡ **Pre-initialization**: Optional runtime pre-loading for reduced latency
- 🧠 **Memory Efficient**: Uses TypedArrays and transferable objects for zero-copy data transfer
- 🎯 **Morphological Trimap**: Fast trimap refinement using erosion for over-confident neural network predictions
- ✨ **Post-Processing**: Optional mask smoothing using morphological operations and Gaussian blur
- 📊 **Progress Callbacks**: Real-time progress updates during initialization and processing
- 🔧 **Configurable Logging**: Verbose logging support for debugging
- 🎨 **Interactive Demo**: Complete web interface for testing the algorithms
- 📱 **Single Image Processing**: Efficient processing of individual images with optimized memory usage

## Installation

```bash
npm install pyomatting
```

## Quick Start

```typescript
import { closedFormMatting, rembgAlphaMatting } from 'pyomatting';

// Basic usage with trimap in alpha channel
const result = await closedFormMatting(imageDataWithTrimap);

// Rembg-compatible usage (recommended for replacing rembg's alpha_matting_cutout)
const result = await rembgAlphaMatting(imageDataWithMask, {
  foregroundThreshold: 240,
  backgroundThreshold: 10,
  erodeStructureSize: 10
});

// With custom max dimension and trimap processing
const result = await closedFormMatting(imageDataWithTrimap, { 
  maxDimension: 512,
  trimapParams: {
    foregroundThreshold: 240,
    backgroundThreshold: 10,
    erodeStructureSize: 10
  }
});
```

## Rembg Replacement

This package can directly replace rembg's `alpha_matting_cutout` function. Use the `rembgAlphaMatting` function with identical parameters:

```typescript
// Instead of rembg's alpha_matting_cutout:
// cutout = alpha_matting_cutout(img, mask, 240, 10, 10)

// Use pyomatting's rembgAlphaMatting:
const cutout = await rembgAlphaMatting(combinedImageData, {
  foregroundThreshold: 240,
  backgroundThreshold: 10, 
  erodeStructureSize: 10
});
```

## Trimap Refinement

For images with neural network predictions (like U²-Net models), the package includes trimap refinement processing that creates better unknown regions for alpha matting:

```typescript
// Apply trimap refinement to expand unknown regions
const result = await closedFormMatting(imageData, {
  trimapParams: {
    foregroundThreshold: 240,    // Pixels above this are definite foreground
    backgroundThreshold: 10,     // Pixels below this are definite background
    erodeStructureSize: 10       // Size of erosion kernel for creating unknown regions
  }
});
```

**Benefits:**
- Creates adaptive unknown bands around foreground/background boundaries
- Handles over-confident predictions from deep learning models
- Compatible with rembg's alpha_matting_cutout parameters
- Kernel size directly specified in pixels for predictable results
```

## API Reference

### Core Functions

#### `closedFormMatting(imageData: ImageData, options?: MattingOptions): Promise<ImageData>`

Performs closed-form alpha matting on a single image with trimap encoded in alpha channel.

**Parameters:**
- `imageData`: ImageData from canvas containing the source image with trimap in alpha channel:
  - RGB channels: Original image colors
  - Alpha channel: Trimap where 0=background, 255=foreground, 128=unknown (to be solved)
- `options`: Optional configuration object:
  - `maxDimension`: Maximum dimension for processing (default: 1024)
  - `trimapParams`: Trimap refinement parameters for expanding unknown regions
  - `postProcessMask`: Apply mask post-processing for smoother boundaries (default: false)
  - `returnOnlyMask`: Debug mode - returns only alpha mask as RGB (default: false)

**Returns:** ImageData containing the computed RGBA result image (with foreground colors and alpha)

#### `rembgAlphaMatting(imageData: ImageData, options?: RembgOptions): Promise<ImageData>`

Rembg-compatible alpha matting function that exactly replicates rembg's `alpha_matting_cutout` behavior.

**Parameters:**
- `imageData`: ImageData from canvas containing the source image with mask in alpha channel
- `options`: Optional configuration object:
  - `maxDimension`: Maximum dimension for processing (default: 1024)
  - `foregroundThreshold`: Threshold for definite foreground (default: 240)
  - `backgroundThreshold`: Threshold for definite background (default: 10)
  - `erodeStructureSize`: Size of erosion structure (default: 10)
  - `postProcessMask`: Apply post-processing for smooth boundaries (default: false)
  - `returnOnlyMask`: Debug mode - return only alpha mask (default: false)

**Returns:** ImageData containing the computed RGBA result image (with foreground colors and alpha)

#### `TrimapParams`

Interface for trimap refinement parameters:

- `foregroundThreshold`: Threshold for definite foreground pixels (default: 240)
- `backgroundThreshold`: Threshold for definite background pixels (default: 10)
- `erodeStructureSize`: Size of erosion structure in pixels (default: 10)

#### `MattingOptions`

Interface for matting configuration:

- `maxDimension`: Maximum dimension for processing (default: 1024)
- `trimapParams`: Trimap refinement parameters (optional)
- `postProcessMask`: Apply post-processing for smooth boundaries (default: false)
- `returnOnlyMask`: Debug mode - return only alpha mask (default: false)

#### `initializePyodide(): Promise<void>`

Pre-initializes the Pyodide runtime and packages. This is optional but recommended for better user experience.

```typescript
import { initializePyodide } from 'pyomatting';

// Pre-initialize to reduce latency for first processing call
await initializePyodide();
```

### Progress & Logging

#### `addProgressCallback(fn: (stage: string, progress: number, message?: string) => void): void`

Add a callback to receive progress updates during initialization and processing.

```typescript
import { addProgressCallback } from 'pyomatting';

addProgressCallback((stage, progress, message) => {
  console.log(`${stage}: ${progress}% - ${message}`);
});
```

#### `setVerboseLogging(verbose: boolean): void`

Enable or disable verbose logging for debugging.

```typescript
import { setVerboseLogging } from 'pyomatting';

setVerboseLogging(true); // Enable detailed logging
```

#### `removeProgressCallback(): void`

Remove the current progress callback.

#### `terminateWorker(): void`

Terminate the web worker (useful for cleanup).

## Example Usage

```typescript
import { 
  closedFormMatting, 
  rembgAlphaMatting,
  addProgressCallback, 
  setVerboseLogging,
  initializePyodide 
} from 'pyomatting';

// Enable logging for development
setVerboseLogging(true);

// Set up progress tracking
addProgressCallback((stage, progress, message) => {
  document.getElementById('progress').textContent = `${message} (${progress}%)`;
});

// Optional: Pre-initialize for faster first run
await initializePyodide();

// For rembg replacement (recommended):
function combineImageWithMask(sourceImg: HTMLImageElement, maskImg: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = sourceImg.width;
  canvas.height = sourceImg.height;
  
  // Draw source image to get RGB data
  ctx.drawImage(sourceImg, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Draw mask to get alpha data
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(maskImg, 0, 0);
  const maskData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Combine: RGB from source, Alpha from mask
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i + 3] = maskData.data[i]; // Alpha from mask's red channel
  }
  
  return imageData;
}

// Rembg-compatible processing with exact same parameters
const combinedData = combineImageWithMask(sourceImage, maskImage);
const result = await rembgAlphaMatting(combinedData, {
  foregroundThreshold: 240,  // Same as rembg default
  backgroundThreshold: 10,   // Same as rembg default  
  erodeStructureSize: 10     // Same as rembg default
});

// With post-processing for smoother results (like rembg)
const result = await rembgAlphaMatting(combinedData, {
  foregroundThreshold: 240,
  backgroundThreshold: 10,
  erodeStructureSize: 10,
  postProcessMask: true      // Enable post-processing
});

// For traditional trimap usage:
function combineImageWithTrimap(sourceImg: HTMLImageElement, trimapImg: HTMLImageElement): ImageData {
  // ... same as above but trimap has specific values: 0=BG, 255=FG, 128=unknown
}

const result = await closedFormMatting(combinedImageData);

// With trimap refinement for neural network masks
const result = await closedFormMatting(combinedImageData, {
  trimapParams: {
    foregroundThreshold: 240,
    backgroundThreshold: 10,
    erodeStructureSize: 10
  }
});
```

### Morphological Trimap Refinement

When working with neural networks like U^2-Net that produce over-confident predictions, the trimap may have too thin unknown regions. Enable morphological trimap processing to:

- **Erode confident regions**: Morphological erosion creates unknown bands around boundaries
- **Fast and effective**: Much faster than edge-detection based approaches
- **Adaptive scaling**: Erosion size adapts to image dimensions for consistent results
- **Better matting**: Creates more appropriate unknown regions for superior alpha mattes

```typescript
// Enable morphological trimap refinement for better results with confident neural networks
const result = await closedFormMatting(combinedImageData, 1024, {
  band_ratio: 0.05,  // 5% erosion - creates larger unknown bands
  mid_band: 0.2,     // Confidence threshold
  returnOnlyTrimap: false  // Debug mode for trimap visualization
});
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run example demo
npm run example
```

The `examples` folder contains a complete interactive demo with:
- Drag & drop image upload interface
- Interactive trimap editor
- Real-time progress tracking
- Sequential processing of multiple images for memory efficiency
- Side-by-side result comparison

## Algorithm

This package implements the closed-form alpha matting algorithm described in:

> **"A Closed-Form Solution to Natural Image Matting"** by Levin, Lischinski, and Weiss (2007)

The implementation is based on the Python version from [MarcoForte/closed-form-matting](https://github.com/MarcoForte/closed-form-matting), adapted to run in the browser using Pyodide.

### How it works:

1. **Laplacian Computation**: Builds a sparse matting Laplacian matrix from local image neighborhoods
2. **Quadratic Optimization**: Formulates alpha estimation as a constrained quadratic optimization problem
3. **Sparse Solving**: Uses sparse linear algebra (SciPy) to solve for alpha values efficiently
4. **Foreground Estimation**: Computes separated foreground colors using additional constraints

## Performance

- **First Run**: ~10-30 seconds (downloads and initializes Pyodide + packages)
- **Subsequent Runs**: ~1-5 seconds per image (cached runtime)
- **Memory**: ~200-500MB (depending on image size and browser)

Use `initializePyodide()` to pre-load the runtime during app initialization for better UX.

## Browser Requirements

- Modern browser with WebAssembly support
- Internet connection (for loading Pyodide and packages from CDN on first run)
- Sufficient memory for image processing (recommend 4GB+ RAM for large images)

## Credits

- **Original Algorithm**: Levin, Lischinski, and Weiss (2007)
- **Python Implementation**: [MarcoForte/closed-form-matting](https://github.com/MarcoForte/closed-form-matting)
- **Web Adaptation**: This package (Pyodide + TypeScript wrapper)

## License

MIT

## Contributing

Issues and pull requests are welcome! Please ensure any changes maintain compatibility with the existing API.
