import { closedFormMatting, addProgressCallback, setVerboseLogging, initializePyodide } from 'pyomatting';

// Global variables to store uploaded images
let sourceImages: HTMLImageElement[] = [];
let trimapImages: HTMLImageElement[] = [];

// Enable verbose logging for development
setVerboseLogging(true);

// DOM elements - cache all references upfront
const elements = {
  imageInput: document.getElementById('imageInput') as HTMLInputElement,
  trimapInput: document.getElementById('trimapInput') as HTMLInputElement,
  imagePreviewContainer: document.getElementById('imagePreviewContainer') as HTMLDivElement,
  trimapPreviewContainer: document.getElementById('trimapPreviewContainer') as HTMLDivElement,
  initBtn: document.getElementById('initBtn') as HTMLButtonElement,
  processBtn: document.getElementById('processBtn') as HTMLButtonElement,
  statusDiv: document.getElementById('status') as HTMLDivElement,
  resultsDiv: document.getElementById('results') as HTMLDivElement,
  resultGrid: document.getElementById('resultGrid') as HTMLDivElement,
  resultCount: document.getElementById('resultCount') as HTMLParagraphElement,
  imageUploadBox: document.getElementById('imageUploadBox') as HTMLDivElement,
  trimapUploadBox: document.getElementById('trimapUploadBox') as HTMLDivElement,
  progressContainer: document.getElementById('progressContainer') as HTMLDivElement,
  progressBar: document.getElementById('progressBar') as HTMLDivElement,
  progressText: document.getElementById('progressText') as HTMLDivElement,
};

function showStatus(message: string, type: 'info' | 'success' | 'error') {
    elements.statusDiv.textContent = message;
    elements.statusDiv.className = `status ${type}`;
    elements.statusDiv.classList.remove('hidden');
}

function hideStatus() {
    elements.statusDiv.classList.add('hidden');
}

function showProgress(show: boolean) {
    if (show) {
        elements.progressContainer.classList.remove('hidden');
    } else {
        elements.progressContainer.classList.add('hidden');
    }
}

function updateProgress(stage: string, percentage: number, message?: string) {
    elements.progressBar.style.width = `${percentage}%`;
    elements.progressBar.textContent = `${percentage}%`;
    
    // Use the provided message, or fallback to stage name
    elements.progressText.textContent = message || stage;
}

function updateProcessButton() {
    elements.processBtn.disabled = sourceImages.length === 0 || trimapImages.length === 0 || sourceImages.length !== trimapImages.length;
    
    // Update status based on counts
    if (sourceImages.length > 0 && trimapImages.length > 0) {
        if (sourceImages.length !== trimapImages.length) {
            showStatus(`Mismatch: ${sourceImages.length} images, ${trimapImages.length} trimaps. Counts must match.`, 'error');
        } else {
            showStatus(`Ready to process ${sourceImages.length} image(s)`, 'success');
        }
    }
}

function createPreviewElement(img: HTMLImageElement, index: number, type: 'image' | 'trimap'): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'preview-item';
    
    const preview = document.createElement('img');
    preview.src = img.src;
    preview.className = 'preview-image';
    preview.alt = `${type} ${index + 1}`;
    
    const label = document.createElement('div');
    label.className = 'preview-label';
    label.textContent = `${type === 'image' ? 'Image' : 'Trimap'} ${index + 1}`;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => removePreview(index, type);
    
    container.appendChild(preview);
    container.appendChild(label);
    container.appendChild(removeBtn);
    
    return container;
}

function removePreview(index: number, type: 'image' | 'trimap') {
    if (type === 'image') {
        sourceImages.splice(index, 1);
        updatePreviews('image');
    } else {
        trimapImages.splice(index, 1);
        updatePreviews('trimap');
    }
    updateProcessButton();
}

function updatePreviews(type: 'image' | 'trimap') {
    const container = type === 'image' ? elements.imagePreviewContainer : elements.trimapPreviewContainer;
    const images = type === 'image' ? sourceImages : trimapImages;
    
    container.innerHTML = '';
    images.forEach((img, index) => {
        const preview = createPreviewElement(img, index, type);
        container.appendChild(preview);
    });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function imageToCanvas(img: HTMLImageElement): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function imageDataToCanvas(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
}

// File input handlers - support multiple files
elements.imageInput.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
        showStatus('Loading image files...', 'info');
        for (let i = 0; i < files.length; i++) {
            try {
                const img = await loadImageFromFile(files[i]);
                sourceImages.push(img);
            } catch (error) {
                showStatus(`Error loading image file ${i + 1}`, 'error');
            }
        }
        updatePreviews('image');
        updateProcessButton();
    }
});

elements.trimapInput.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
        showStatus('Loading trimap files...', 'info');
        for (let i = 0; i < files.length; i++) {
            try {
                const img = await loadImageFromFile(files[i]);
                trimapImages.push(img);
            } catch (error) {
                showStatus(`Error loading trimap file ${i + 1}`, 'error');
            }
        }
        updatePreviews('trimap');
        updateProcessButton();
    }
});

// Drag and drop handlers
function setupDragAndDrop(element: HTMLElement, isTrimap: boolean = false) {
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
            showStatus(`Loading ${files.length} ${isTrimap ? 'trimap' : 'image'} file(s)...`, 'info');
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type.startsWith('image/')) {
                    try {
                        const img = await loadImageFromFile(file);
                        if (isTrimap) {
                            trimapImages.push(img);
                        } else {
                            sourceImages.push(img);
                        }
                    } catch (error) {
                        showStatus(`Error loading ${isTrimap ? 'trimap' : 'image'} file ${i + 1}`, 'error');
                    }
                } else {
                    showStatus(`File ${i + 1} is not an image`, 'error');
                }
            }
            
            updatePreviews(isTrimap ? 'trimap' : 'image');
            updateProcessButton();
        }
    });
}

setupDragAndDrop(elements.imageUploadBox, false);
setupDragAndDrop(elements.trimapUploadBox, true);

// Pre-initialization button
elements.initBtn.addEventListener('click', async () => {
    elements.initBtn.disabled = true;
    showProgress(true);
    
    try {
        // Set up progress callback
        addProgressCallback((stage: string, progress: number, message?: string) => {
            updateProgress(stage, progress, message);
            console.log(`Progress: ${stage} - ${progress}% - ${message || 'No message'}`);
        });
        
        showStatus('🔄 Pre-initializing Pyodide runtime...', 'info');
        await initializePyodide();
        showStatus('✅ Pyodide runtime pre-initialized successfully!', 'success');
        elements.initBtn.textContent = '✅ Runtime Ready';
    } catch (error) {
        console.error('Error pre-initializing Pyodide:', error);
        showStatus(`❌ Error pre-initializing Pyodide: ${error}`, 'error');
        elements.initBtn.disabled = false;
    } finally {
        showProgress(false);
    }
});

// Process matting button
elements.processBtn.addEventListener('click', async () => {
    if (sourceImages.length === 0 || trimapImages.length === 0) {
        showStatus('Please upload both images and trimaps', 'error');
        return;
    }

    if (sourceImages.length !== trimapImages.length) {
        showStatus('Number of images and trimaps must match', 'error');
        return;
    }

    elements.processBtn.disabled = true;
    showProgress(true);
    showStatus(`🔄 Processing ${sourceImages.length} image(s)... This may take a while.`, 'info');

    // Set up progress callback
    addProgressCallback((stage: string, progress: number, message?: string) => {
        updateProgress(stage, progress, message);
        console.log(`Progress: ${stage} - ${progress}% - ${message || 'No message'}`);
    });

    try {
        for (let i = 0; i < sourceImages.length; i++) {
            if (sourceImages[i].width !== trimapImages[i].width || 
                sourceImages[i].height !== trimapImages[i].height) {
                showStatus(`Error: Image ${i + 1} and its trimap must have the same dimensions`, 'error');
                elements.processBtn.disabled = false;
                showProgress(false);
                return;
            }
        }

        console.log(`Processing ${sourceImages.length} images sequentially`);

        // Display results
        elements.resultGrid.innerHTML = '';
        const rgbaResults: ImageData[] = [];
        
        // Process each image individually (more memory efficient than batch)
        for (let i = 0; i < sourceImages.length; i++) {
            // Update progress for current image
            const imageProgress = Math.round((i / sourceImages.length) * 100);
            updateProgress('processing', imageProgress, `Processing image ${i + 1} of ${sourceImages.length}...`);
            
            // Convert current image to ImageData
            const imageData = imageToCanvas(sourceImages[i]);
            const trimapData = imageToCanvas(trimapImages[i]);

            console.log(`Processing image ${i + 1}: ${imageData.width}x${imageData.height}`);

            // Perform single image matting
            const rgbaResult = await closedFormMatting(imageData, trimapData);
            rgbaResults.push(rgbaResult);

            // Create result display for this image
            const resultContainer = document.createElement('div');
            resultContainer.className = 'result-set';
            
            const resultHeader = document.createElement('h4');
            resultHeader.textContent = `Result ${i + 1}`;
            resultContainer.appendChild(resultHeader);
            
            const resultRow = document.createElement('div');
            resultRow.className = 'result-row';
            
            // Original image
            const originalBox = document.createElement('div');
            originalBox.className = 'result-box';
            const originalTitle = document.createElement('h5');
            originalTitle.textContent = 'Original';
            const originalImg = document.createElement('img');
            originalImg.src = sourceImages[i].src;
            originalImg.className = 'result-image';
            originalBox.appendChild(originalTitle);
            originalBox.appendChild(originalImg);
            
            // Trimap
            const trimapBox = document.createElement('div');
            trimapBox.className = 'result-box';
            const trimapTitle = document.createElement('h5');
            trimapTitle.textContent = 'Trimap';
            const trimapImg = document.createElement('img');
            trimapImg.src = trimapImages[i].src;
            trimapImg.className = 'result-image';
            trimapBox.appendChild(trimapTitle);
            trimapBox.appendChild(trimapImg);
            
            // Result (RGBA with foreground and alpha)
            const resultBox = document.createElement('div');
            resultBox.className = 'result-box';
            const resultTitle = document.createElement('h5');
            resultTitle.textContent = 'Result (RGBA)';
            const resultImg = document.createElement('img');
            resultImg.src = imageDataToCanvas(rgbaResult);
            resultImg.className = 'result-image';
            resultBox.appendChild(resultTitle);
            resultBox.appendChild(resultImg);
            
            resultRow.appendChild(originalBox);
            resultRow.appendChild(trimapBox);
            resultRow.appendChild(resultBox);
            resultContainer.appendChild(resultRow);
            elements.resultGrid.appendChild(resultContainer);
        }

        elements.resultCount.textContent = `Processed ${rgbaResults.length} image(s) successfully`;
        elements.resultsDiv.classList.remove('hidden');
        showStatus('✅ Alpha matting and foreground estimation completed successfully!', 'success');

    } catch (error) {
        console.error('Error processing batch matting:', error);
        showStatus(`❌ Error processing matting: ${error}`, 'error');
    } finally {
        elements.processBtn.disabled = false;
        showProgress(false);
    }
});

// Initialize
console.log('Batch demo loaded. Upload multiple images and trimaps to get started!');

// Enable multiple file selection
elements.imageInput.multiple = true;
elements.trimapInput.multiple = true;
