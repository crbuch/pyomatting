import { callPyodide, closedFormMatting } from 'pyomatting';

// Global variables to store uploaded images
let sourceImage: HTMLImageElement | null = null;
let trimapImage: HTMLImageElement | null = null;

// DOM elements
const imageInput = document.getElementById('imageInput') as HTMLInputElement;
const trimapInput = document.getElementById('trimapInput') as HTMLInputElement;
const imagePreview = document.getElementById('imagePreview') as HTMLImageElement;
const trimapPreview = document.getElementById('trimapPreview') as HTMLImageElement;
const callPyodideBtn = document.getElementById('callPyodideBtn') as HTMLButtonElement;
const processBtn = document.getElementById('processBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const imageUploadBox = document.getElementById('imageUploadBox') as HTMLDivElement;
const trimapUploadBox = document.getElementById('trimapUploadBox') as HTMLDivElement;

// Canvas elements for image processing
const imageCanvas = document.getElementById('imageCanvas') as HTMLCanvasElement;
const trimapCanvas = document.getElementById('trimapCanvas') as HTMLCanvasElement;
const resultCanvas = document.getElementById('resultCanvas') as HTMLCanvasElement;

// Result images
const originalResult = document.getElementById('originalResult') as HTMLImageElement;
const trimapResult = document.getElementById('trimapResult') as HTMLImageElement;
const alphaResult = document.getElementById('alphaResult') as HTMLImageElement;

function showStatus(message: string, type: 'info' | 'success' | 'error') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
}

function hideStatus() {
    statusDiv.classList.add('hidden');
}

function updateProcessButton() {
    processBtn.disabled = !sourceImage || !trimapImage;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function imageToCanvas(img: HTMLImageElement, canvas: HTMLCanvasElement): ImageData {
    const ctx = canvas.getContext('2d')!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function imageDataToCanvas(imageData: ImageData, canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext('2d')!;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
}

// File input handlers
imageInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            sourceImage = await loadImageFromFile(file);
            imagePreview.src = sourceImage.src;
            imagePreview.classList.remove('hidden');
            updateProcessButton();
        } catch (error) {
            showStatus('Error loading image file', 'error');
        }
    }
});

trimapInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            trimapImage = await loadImageFromFile(file);
            trimapPreview.src = trimapImage.src;
            trimapPreview.classList.remove('hidden');
            updateProcessButton();
        } catch (error) {
            showStatus('Error loading trimap file', 'error');
        }
    }
});

// Drag and drop handlers
function setupDragAndDrop(element: HTMLElement, input: HTMLInputElement, isTrimap: boolean = false) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('dragover');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('dragover');
    });

    element.addEventListener('drop', async (e) => {
        e.preventDefault();
        element.classList.remove('dragover');
        
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                try {
                    const img = await loadImageFromFile(file);
                    if (isTrimap) {
                        trimapImage = img;
                        trimapPreview.src = img.src;
                        trimapPreview.classList.remove('hidden');
                    } else {
                        sourceImage = img;
                        imagePreview.src = img.src;
                        imagePreview.classList.remove('hidden');
                    }
                    updateProcessButton();
                } catch (error) {
                    showStatus(`Error loading ${isTrimap ? 'trimap' : 'image'} file`, 'error');
                }
            } else {
                showStatus('Please drop an image file', 'error');
            }
        }
    });
}

setupDragAndDrop(imageUploadBox, imageInput, false);
setupDragAndDrop(trimapUploadBox, trimapInput, true);

// Test Pyodide button
callPyodideBtn.addEventListener('click', async () => {
    callPyodideBtn.disabled = true;
    showStatus('🚀 Calling Pyodide...', 'info');
    
    try {
        await callPyodide();
        showStatus('✅ Pyodide test completed successfully!', 'success');
    } catch (error) {
        console.error('ERROR: Error calling Pyodide:', error);
        showStatus(`❌ Error calling Pyodide: ${error}`, 'error');
    } finally {
        callPyodideBtn.disabled = false;
    }
});

// Process matting button
processBtn.addEventListener('click', async () => {
    if (!sourceImage || !trimapImage) {
        showStatus('Please upload both an image and a trimap', 'error');
        return;
    }

    processBtn.disabled = true;
    showStatus('🔄 Processing alpha matting... This may take a while.', 'info');

    try {
        // Check image dimensions
        if (sourceImage.width !== trimapImage.width || sourceImage.height !== trimapImage.height) {
            showStatus('Error: Image and trimap must have the same dimensions', 'error');
            processBtn.disabled = false;
            return;
        }

        // Convert images to ImageData
        const imageData = imageToCanvas(sourceImage, imageCanvas);
        const trimapData = imageToCanvas(trimapImage, trimapCanvas);

        console.log(`Processing images: ${imageData.width}x${imageData.height}`);

        // Perform matting
        const alphaImageData = await closedFormMatting(imageData, trimapData);

        // Display results
        originalResult.src = sourceImage.src;
        trimapResult.src = trimapImage.src;
        alphaResult.src = imageDataToCanvas(alphaImageData, resultCanvas);

        resultsDiv.classList.remove('hidden');
        showStatus('✅ Alpha matting completed successfully!', 'success');

    } catch (error) {
        console.error('Error processing matting:', error);
        showStatus(`❌ Error processing matting: ${error}`, 'error');
    } finally {
        processBtn.disabled = false;
    }
});

// Initialize
console.log('Demo loaded. Upload an image and trimap to get started!');
