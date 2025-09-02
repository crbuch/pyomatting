import numpy as np
import time
import cv2

def entropy_trimap(prob, band_ratio=0.01, mid_band=0.2):
    """
    Creates an uncertainty-driven trimap with adaptive band width.
    
    Args:
        prob: Probability map (0-1) where 1=foreground, 0=background
        band_ratio: Minimum band width as a fraction of min(H,W) (e.g., 1%)
        mid_band: |p-0.5| <= mid_band becomes unknown (e.g., 0.2 -> [0.3,0.7])
    
    Returns:
        trimap: uint8 array with 0=background, 255=foreground, 128=unknown
    """
    h, w = prob.shape
    
    # Base certainty thresholds from mid-band
    fg = prob >= (0.5 + mid_band)
    bg = prob <= (0.5 - mid_band)
    unknown = ~(fg | bg)

    # Guarantee a geometric band around FG/BG boundaries
    mask = ((fg.astype(np.uint8) * 2) + bg.astype(np.uint8))  # 2=fg, 1=bg, 0=unknown
    edges = cv2.Canny((mask * 100).astype(np.uint8), 0, 100)
    band_px = max(1, int(round(min(h, w) * band_ratio)))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * band_px + 1, 2 * band_px + 1))
    unknown |= (cv2.dilate(edges, k) > 0)

    trimap = np.full((h, w), 128, np.uint8)
    trimap[bg] = 0
    trimap[fg] = 255
    return trimap

# Performance timing for optimization
start_time = time.time()

# Use logger if available, otherwise fallback to print
def log_message(message):
    if 'py_logger' in globals():
        py_logger(message) # type: ignore
    else:
        print(message)

def send_progress(percentage, message):
    if 'send_progress_callback' in globals():
        send_progress_callback(percentage, message) # type: ignore

def log_timing(stage, start_t):
    """Log timing information for performance monitoring."""
    elapsed = time.time() - start_t
    log_message(f"{stage} took {elapsed:.2f} seconds")
    return time.time()

log_message("Starting single image processing with trimap in alpha channel")

# Get combined data from memoryview (efficient, no copy)
combined_buffer = np.asarray(combined_data_buffer) # type: ignore

# Get dimensions and parameters
width = image_width # type: ignore
height = image_height # type: ignore
channels = image_channels # type: ignore
use_entropy = use_entropy_trimap # type: ignore

log_message(f"Combined image dimensions: {width}x{height}x{channels}")
log_message(f"Entropy trimap processing: {'enabled' if use_entropy else 'disabled'}")

send_progress(10, "Extracting image and trimap from alpha channel...")
reshape_start = time.time()

# Reshape buffer to proper image format (RGBA)
combined_rgba = combined_buffer.reshape((height, width, channels))

# Extract the original image from RGB channels
image_rgb = (combined_rgba[:, :, :3]).astype(np.float32, copy=False) * (1.0/255.0)

# Extract the trimap from alpha channel
trimap_alpha_raw = (combined_rgba[:, :, 3]).astype(np.float32, copy=False) * (1.0/255.0)

# Apply entropy trimap processing if requested
if use_entropy:
    log_message("Applying entropy-based trimap refinement...")
    send_progress(20, "Refining trimap with entropy analysis...")
    
    # Convert to 0-1 probability map for entropy processing
    trimap_entropy = entropy_trimap(trimap_alpha_raw, band_ratio=0.01, mid_band=0.2)
    trimap_alpha = trimap_entropy.astype(np.float32) / 255.0
    log_message(f"Entropy trimap applied: {np.sum(trimap_entropy == 128)} unknown pixels")
else:
    trimap_alpha = trimap_alpha_raw

log_timing("Data extraction and reshaping", reshape_start)

log_message(f"Image RGB shape: {image_rgb.shape}, range: {image_rgb.min():.3f} to {image_rgb.max():.3f}")
log_message(f"Trimap shape: {trimap_alpha.shape}, range: {trimap_alpha.min():.3f} to {trimap_alpha.max():.3f}")

send_progress(30, "Computing alpha matte...")
matting_start = time.time()

# Perform closed-form matting
try:
    alpha_result = closed_form_matting_with_trimap(image_rgb, trimap_alpha) # type: ignore
    matting_time = log_timing("Alpha matting", matting_start)
    log_message(f"Alpha result shape: {alpha_result.shape}, range: {alpha_result.min():.3f} to {alpha_result.max():.3f}")
    
    send_progress(70, "Computing foreground estimation...")
    fg_start = time.time()
    
    # Compute foreground estimation
    foreground_result, _ = solve_foreground_background(image_rgb, alpha_result) # type: ignore
    log_timing("Foreground estimation", fg_start)
    log_message(f"Foreground result shape: {foreground_result.shape}, range: {foreground_result.min():.3f} to {foreground_result.max():.3f}")
    
except Exception as e:
    log_message(f"Error in matting: {e}")
    import traceback
    traceback.print_exc()
    alpha_result = trimap_alpha  # Fallback to trimap
    foreground_result = image_rgb  # Fallback to original image

send_progress(90, "Preparing results...")

# Flatten results for efficient transfer - avoid creating temporary variables
# Use copy=False to avoid unnecessary copying when possible
alpha_result = alpha_result.astype(np.float32, copy=False).ravel()
foreground_result = foreground_result.astype(np.float32, copy=False).ravel()
result_width = width
result_height = height

send_progress(100, "Processing complete!")

log_message(f"Processing completed: alpha shape {alpha_result.shape}, foreground shape {foreground_result.shape}")
