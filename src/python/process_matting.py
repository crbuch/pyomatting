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
