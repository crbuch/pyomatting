import numpy as np

# Process batch of images
batch_alpha_lists = []

print(f"Processing batch of {len(batch_image_data)} images")

for batch_idx in range(len(batch_image_data)):
    # Convert image data to numpy array
    image_array = np.array(batch_image_data[batch_idx], dtype=np.uint8)
    width = batch_widths[batch_idx]
    height = batch_heights[batch_idx]
    
    image_rgba = image_array.reshape((height, width, 4))
    image_rgb = image_rgba[:, :, :3].astype(np.float32) / 255.0

    # Convert trimap data to numpy array  
    trimap_array = np.array(batch_trimap_data[batch_idx], dtype=np.uint8)
    trimap_rgba = trimap_array.reshape((height, width, 4))
    trimap_gray = np.mean(trimap_rgba[:, :, :3], axis=2).astype(np.float32) / 255.0

    print(f"Image {batch_idx + 1}: shape {image_rgb.shape}, trimap shape {trimap_gray.shape}")

    # Perform closed-form matting
    try:
        alpha_result = closed_form_matting_with_trimap(image_rgb, trimap_gray)
        print(f"Image {batch_idx + 1}: Alpha result shape {alpha_result.shape}, range {alpha_result.min():.3f} to {alpha_result.max():.3f}")
    except Exception as e:
        print(f"Error in matting for image {batch_idx + 1}: {e}")
        import traceback
        traceback.print_exc()
        alpha_result = trimap_gray  # Fallback to trimap

    # Convert result to list for JavaScript
    alpha_list = alpha_result.flatten().tolist()
    batch_alpha_lists.append(alpha_list)

print(f"Batch processing completed: {len(batch_alpha_lists)} results")
