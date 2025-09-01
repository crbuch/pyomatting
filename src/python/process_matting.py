import numpy as np
import time

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

# Get dimensions
width = image_width # type: ignore
height = image_height # type: ignore
channels = image_channels # type: ignore

log_message(f"Combined image dimensions: {width}x{height}x{channels}")

send_progress(10, "Extracting image and trimap from alpha channel...")
reshape_start = time.time()

# Reshape buffer to proper image format (RGBA)
combined_rgba = combined_buffer.reshape((height, width, channels))

# Extract the original image from RGB channels
image_rgb = (combined_rgba[:, :, :3]).astype(np.float32, copy=False) * (1.0/255.0)

# Extract the trimap from alpha channel
trimap_alpha = (combined_rgba[:, :, 3]).astype(np.float32, copy=False) * (1.0/255.0)

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
