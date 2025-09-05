import numpy as np
from scipy.ndimage import binary_erosion

# The closed-form matting functions are already loaded in the worker
# We can use them directly since they're in the global namespace

# Use logger if available, otherwise fallback to print
def log_message(message):
    if 'py_logger' in globals():
        py_logger(message) # type: ignore
    else:
        print(message)

def send_progress(percentage, message):
    if 'send_progress_callback' in globals():
        send_progress_callback(percentage, message) # type: ignore

def alpha_matting_cutout_rembg(img_array, mask_array, foreground_threshold=240, background_threshold=10, erode_structure_size=10):
    """
    Exact implementation of rembg's alpha_matting_cutout function.
    
    Args:
        img_array: numpy array (RGB, 0-255 uint8)
        mask_array: numpy array (grayscale mask from U^2-Net, 0-255 uint8)
        foreground_threshold: threshold for definite foreground (default: 240)
        background_threshold: threshold for definite background (default: 10)
        erode_structure_size: size of erosion structure (default: 10)
    
    Returns:
        cutout: RGBA numpy array (0-255 uint8) with alpha matted result
    """
    log_message(f"Starting alpha matting cutout - img shape: {img_array.shape}, mask shape: {mask_array.shape}")
    log_message(f"Image range: {img_array.min()}-{img_array.max()}, Mask range: {mask_array.min()}-{mask_array.max()}")
    
    # Step 1: Create trimap using exact rembg binary erosion logic
    send_progress(10, "Creating trimap with binary erosion...")
    
    is_foreground = mask_array > foreground_threshold
    is_background = mask_array < background_threshold

    structure = None
    if erode_structure_size > 0:
        structure = np.ones((erode_structure_size, erode_structure_size), dtype=np.uint8)

    is_foreground = binary_erosion(is_foreground, structure=structure)
    is_background = binary_erosion(is_background, structure=structure, border_value=1)

    trimap = np.full(mask_array.shape, dtype=np.uint8, fill_value=128)
    trimap[is_foreground] = 255
    trimap[is_background] = 0
    
    fg_pixels = np.sum(trimap == 255)
    bg_pixels = np.sum(trimap == 0)
    unknown_pixels = np.sum(trimap == 128)
    log_message(f"Trimap created: FG={fg_pixels}, BG={bg_pixels}, Unknown={unknown_pixels}")
    
    # Step 2: Normalize data for closed-form matting (exact rembg approach)
    send_progress(30, "Normalizing data for closed-form matting...")
    
    img_normalized = img_array.astype(np.float64) / 255.0
    trimap_normalized = trimap.astype(np.float64) / 255.0
    
    log_message(f"Normalized - img range: {img_normalized.min():.3f}-{img_normalized.max():.3f}")
    log_message(f"Normalized - trimap range: {trimap_normalized.min():.3f}-{trimap_normalized.max():.3f}")
    
    # Step 3: Apply closed-form matting (using the functions loaded by the worker)
    send_progress(50, "Computing alpha matte with closed-form matting...")
    
    # Use the closed_form_matting_with_trimap function that's already loaded
    alpha = closed_form_matting_with_trimap(img_normalized, trimap_normalized) # type: ignore
    
    log_message(f"Alpha computed, range: {alpha.min():.3f} to {alpha.max():.3f}")
    
    # Step 4: Estimate foreground using ML approach (exact rembg approach)
    send_progress(70, "Estimating foreground colors...")
    
    # Use the solve_foreground_background function that's already loaded
    foreground, background = solve_foreground_background(img_normalized, alpha) # type: ignore
    
    log_message(f"Foreground estimated, range: {foreground.min():.3f} to {foreground.max():.3f}")
    
    # Step 5: Stack foreground and alpha to create RGBA (exact rembg approach)
    # This is equivalent to pymatting.util.util.stack_images(foreground, alpha)
    send_progress(85, "Creating final RGBA cutout...")
    
    cutout = np.dstack((foreground, alpha))
    
    # Step 6: Convert back to 0-255 range and clamp (exact rembg approach)
    cutout = np.clip(cutout * 255, 0, 255).astype(np.uint8)
    
    log_message(f"Final cutout shape: {cutout.shape}, range: {cutout.min()} to {cutout.max()}")
    
    return cutout

# Main processing entry point
def process_alpha_matting():
    """Main processing function that gets called from the worker"""
    log_message("Starting rembg-compatible alpha matting process")

    # Get input data from global variables set by the worker
    image_data_buffer = np.asarray(image_data_buffer_global) # type: ignore
    trimap_data_buffer = np.asarray(trimap_data_buffer_global) # type: ignore

    image_width = image_width_global # type: ignore
    image_height = image_height_global # type: ignore

    log_message(f"Processing {image_width}x{image_height} image")

    send_progress(5, "Reshaping input data...")

    # Reshape image data (RGB, 3 channels)
    image_rgb = image_data_buffer.reshape((image_height, image_width, 3))

    # Reshape trimap data (grayscale, 1 channel) 
    trimap_gray = trimap_data_buffer.reshape((image_height, image_width))

    log_message(f"Image shape: {image_rgb.shape}, Trimap shape: {trimap_gray.shape}")
    log_message(f"Image range: {image_rgb.min()} to {image_rgb.max()}")
    log_message(f"Trimap range: {trimap_gray.min()} to {trimap_gray.max()}")

    # Apply exact rembg alpha_matting_cutout algorithm with default parameters
    result_rgba = alpha_matting_cutout_rembg(
        image_rgb,
        trimap_gray,
        foreground_threshold=240,
        background_threshold=10,
        erode_structure_size=10
    )

    send_progress(95, "Preparing output...")

    # Set global variables for the worker to retrieve
    global result_data_global, result_width_global, result_height_global
    result_data_global = result_rgba.ravel()
    result_width_global = image_width
    result_height_global = image_height

    send_progress(100, "Alpha matting completed!")

    log_message(f"Processing completed. Result shape: {result_rgba.shape}, flattened size: {len(result_data_global)}")

# Check if we're being called from the worker
if 'image_data_buffer_global' in globals():
    process_alpha_matting()