import { closedFormMatting, addProgressCallback, setVerboseLogging, initializePyodide } from 'pyomatting';

// Global variables to store uploaded images
let sourceImages: HTMLImageElement[] = [];
let trimapImages: HTMLImageElement[] = [];

// Enable verbose logging for development
setVerboseLogging(true);

// DOM elements
const imageInput = document.getElementById('imageInput') as HTMLInputElement;
const trimapInput = document.getElementById('trimapInput') as HTMLInputElement;
const imagePreviewContainer = document.getElementById('imagePreviewContainer') as HTMLDivElement;
const trimapPreviewContainer = document.getElementById('trimapPreviewContainer') as HTMLDivElement;
const initBtn = document.getElementById('initBtn') as HTMLButtonElement;
const processBtn = document.getElementById('processBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const resultGrid = document.getElementById('resultGrid') as HTMLDivElement;
const resultCount = document.getElementById('resultCount') as HTMLParagraphElement;
const imageUploadBox = document.getElementById('imageUploadBox') as HTMLDivElement;
const trimapUploadBox = document.getElementById('trimapUploadBox') as HTMLDivElement;
const progressContainer = document.getElementById('progressContainer') as HTMLDivElement;
const progressBar = document.getElementById('progressBar') as HTMLDivElement;
const progressText = document.getElementById('progressText') as HTMLDivElement;

function showStatus(message: string, type: 'info' | 'success' | 'error') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
}

function hideStatus() {
    statusDiv.classList.add('hidden');
}

function showProgress(show: boolean) {
    if (show) {
        progressContainer.classList.remove('hidden');
    } else {
        progressContainer.classList.add('hidden');
    }
}

function updateProgress(stage: string, percentage: number, message?: string) {
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${percentage}%`;
    
    // Use the provided message, or fallback to stage name
    progressText.textContent = message || stage;
}

function updateProcessButton() {
    processBtn.disabled = sourceImages.length === 0 || trimapImages.length === 0 || sourceImages.length !== trimapImages.length;
    
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
    const container = type === 'image' ? imagePreviewContainer : trimapPreviewContainer;
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
imageInput.addEventListener('change', async (e) => {
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

trimapInput.addEventListener('change', async (e) => {
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

setupDragAndDrop(imageUploadBox, false);
setupDragAndDrop(trimapUploadBox, true);

// Pre-initialization button
initBtn.addEventListener('click', async () => {
    initBtn.disabled = true;
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
        initBtn.textContent = '✅ Runtime Ready';
    } catch (error) {
        console.error('Error pre-initializing Pyodide:', error);
        showStatus(`❌ Error pre-initializing Pyodide: ${error}`, 'error');
        initBtn.disabled = false;
    } finally {
        showProgress(false);
    }
});

// Process matting button
processBtn.addEventListener('click', async () => {
    if (sourceImages.length === 0 || trimapImages.length === 0) {
        showStatus('Please upload both images and trimaps', 'error');
        return;
    }

    if (sourceImages.length !== trimapImages.length) {
        showStatus('Number of images and trimaps must match', 'error');
        return;
    }

    processBtn.disabled = true;
    showProgress(true);
    showStatus(`🔄 Processing ${sourceImages.length} image(s)... This may take a while.`, 'info');

    // Set up progress callback
    addProgressCallback((stage: string, progress: number, message?: string) => {
        updateProgress(stage, progress, message);
        console.log(`Progress: ${stage} - ${progress}% - ${message || 'No message'}`);
    });

    try {
        // Check that all image dimensions match their corresponding trimap
        for (let i = 0; i < sourceImages.length; i++) {
            if (sourceImages[i].width !== trimapImages[i].width || 
                sourceImages[i].height !== trimapImages[i].height) {
                showStatus(`Error: Image ${i + 1} and its trimap must have the same dimensions`, 'error');
                processBtn.disabled = false;
                showProgress(false);
                return;
            }
        }

        // Convert all images to ImageData arrays
        const imageDataArray: ImageData[] = sourceImages.map(img => imageToCanvas(img));
        const trimapDataArray: ImageData[] = trimapImages.map(img => imageToCanvas(img));

        console.log(`Processing ${imageDataArray.length} images in batch`);

        // Perform batch matting
        const rgbaResults = await closedFormMatting(imageDataArray, trimapDataArray);

        // Display results
        resultGrid.innerHTML = '';
        
        for (let i = 0; i < rgbaResults.length; i++) {
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
            resultImg.src = imageDataToCanvas(rgbaResults[i]);
            resultImg.className = 'result-image';
            resultBox.appendChild(resultTitle);
            resultBox.appendChild(resultImg);
            
            resultRow.appendChild(originalBox);
            resultRow.appendChild(trimapBox);
            resultRow.appendChild(resultBox);
            resultContainer.appendChild(resultRow);
            resultGrid.appendChild(resultContainer);
        }

        resultCount.textContent = `Processed ${rgbaResults.length} image(s) successfully`;
        resultsDiv.classList.remove('hidden');
        showStatus('✅ Batch alpha matting and foreground estimation completed successfully!', 'success');

    } catch (error) {
        console.error('Error processing batch matting:', error);
        showStatus(`❌ Error processing matting: ${error}`, 'error');
    } finally {
        processBtn.disabled = false;
        showProgress(false);
    }
});

// Initialize
console.log('Batch demo loaded. Upload multiple images and trimaps to get started!');

// Enable multiple file selection
imageInput.multiple = true;
trimapInput.multiple = true;
