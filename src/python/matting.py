import numpy as np
import scipy.sparse
import scipy.sparse.linalg

def closed_form_matting_with_prior(image, prior, prior_confidence, consts_map=None):
    """Applies closed form matting with prior alpha map to image."""
    assert image.shape[:2] == prior.shape, 'prior must be 2D matrix with height and width equal to image.'
    assert image.shape[:2] == prior_confidence.shape, 'prior_confidence must be 2D matrix with height and width equal to image.'
    assert (consts_map is None) or image.shape[:2] == consts_map.shape, 'consts_map must be 2D matrix with height and width equal to image.'
    
    h, w = image.shape[:2]
    
    # Identify unknown pixels (pixels that need to be solved)
    if consts_map is not None:
        unknown_mask = ~consts_map
    else:
        # If no constraints map, assume all pixels with intermediate confidence need solving
        unknown_mask = (prior_confidence > 0) & (prior_confidence < prior_confidence.max())
    
    unknown_pixels = np.where(unknown_mask.ravel())[0]
    num_unknown = len(unknown_pixels)
    
    # If no unknown pixels, return the prior as-is
    if num_unknown == 0:
        return np.minimum(np.maximum(prior, 0), 1)
    
    # Create mapping from full image indices to unknown pixel indices
    full_to_unknown = np.full(h * w, -1, dtype=np.int32)
    full_to_unknown[unknown_pixels] = np.arange(num_unknown)
    
    # Compute full Laplacian but only extract submatrix for unknown pixels
    laplacian_full = compute_laplacian(image, ~consts_map if consts_map is not None else None) #type: ignore
    
    # Extract submatrix for unknown-to-unknown interactions
    laplacian_unknown = laplacian_full[unknown_pixels][:, unknown_pixels]
    
    # Handle boundary conditions: compute Laplacian * known_values
    known_mask = ~unknown_mask
    if np.any(known_mask):
        known_pixels = np.where(known_mask.ravel())[0]
        known_values = prior.ravel()[known_pixels]
        
        # Get unknown-to-known interactions
        laplacian_boundary = laplacian_full[unknown_pixels][:, known_pixels]
        boundary_contribution = laplacian_boundary.dot(known_values)
    else:
        boundary_contribution = np.zeros(num_unknown)
    
    # Set up right-hand side: -boundary_contribution + confidence*prior for unknown pixels
    confidence_unknown = prior_confidence.ravel()[unknown_pixels]
    prior_unknown = prior.ravel()[unknown_pixels]
    rhs = -boundary_contribution + confidence_unknown * prior_unknown
    
    # Add confidence to diagonal of Laplacian submatrix
    confidence_diag = scipy.sparse.diags(confidence_unknown)
    system_matrix = laplacian_unknown + confidence_diag
    
    # Solve the reduced system (only for unknown pixels)
    try:
        solution_unknown = scipy.sparse.linalg.spsolve(system_matrix, rhs)
    except Exception as e:
        # Fallback: use prior values if solve fails
        print(f"Sparse solve failed: {e}")
        solution_unknown = prior_unknown
    
    # Reconstruct full solution
    solution_full = prior.ravel().copy()
    solution_full[unknown_pixels] = solution_unknown
    
    alpha = np.minimum(np.maximum(solution_full.reshape(prior.shape), 0), 1)
    return alpha

def closed_form_matting_with_trimap(image, trimap, trimap_confidence=100.0):
    """Apply Closed-Form matting to given image using trimap."""
    assert image.shape[:2] == trimap.shape, 'trimap must be 2D matrix with height and width equal to image.'
    
    # Known pixels: definite foreground (>0.9) or background (<0.1)
    consts_map = (trimap < 0.1) | (trimap > 0.9)
    
    # High confidence for known pixels, zero for unknown
    confidence_map = trimap_confidence * consts_map.astype(np.float64)
    
    return closed_form_matting_with_prior(image, trimap, confidence_map, consts_map)