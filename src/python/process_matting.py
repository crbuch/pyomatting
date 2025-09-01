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

log_message("Starting single image processing")

# Get image data from memoryview (efficient, no copy)
image_buffer = np.asarray(image_data_buffer) # type: ignore
trimap_buffer = np.asarray(trimap_data_buffer) # type: ignore

# Get dimensions
width = image_width # type: ignore
height = image_height # type: ignore
img_channels = image_channels # type: ignore
trimap_w = trimap_width # type: ignore  
trimap_h = trimap_height # type: ignore
trimap_ch = trimap_channels # type: ignore

log_message(f"Image dimensions: {width}x{height}x{img_channels}")
log_message(f"Trimap dimensions: {trimap_w}x{trimap_h}x{trimap_ch}")

send_progress(10, "Reshaping image data...")
reshape_start = time.time()

# Reshape buffers to proper image format
image_rgba = image_buffer.reshape((height, width, img_channels))
# More efficient RGB extraction - direct slice, no division by zero check needed
image_rgb = (image_rgba[:, :, :3]).astype(np.float32, copy=False) * (1.0/255.0)

trimap_rgba = trimap_buffer.reshape((trimap_h, trimap_w, trimap_ch))
# More efficient grayscale conversion using vectorized operations
trimap_gray = (trimap_rgba[:, :, 0] * 0.299 + 
               trimap_rgba[:, :, 1] * 0.587 + 
               trimap_rgba[:, :, 2] * 0.114).astype(np.float32, copy=False) * (1.0/255.0)

log_timing("Data reshaping", reshape_start)

log_message(f"Image RGB shape: {image_rgb.shape}, range: {image_rgb.min():.3f} to {image_rgb.max():.3f}")
log_message(f"Trimap shape: {trimap_gray.shape}, range: {trimap_gray.min():.3f} to {trimap_gray.max():.3f}")

send_progress(30, "Computing alpha matte...")
matting_start = time.time()

# Perform closed-form matting
try:
    alpha_result = closed_form_matting_with_trimap(image_rgb, trimap_gray) # type: ignore
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
    alpha_result = trimap_gray  # Fallback to trimap
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
