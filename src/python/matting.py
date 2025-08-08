import numpy as np
import scipy.sparse
import scipy.sparse.linalg

def closed_form_matting_with_prior(image, prior, prior_confidence, consts_map=None):
    """Applies closed form matting with prior alpha map to image."""
    assert image.shape[:2] == prior.shape, 'prior must be 2D matrix with height and width equal to image.'
    assert image.shape[:2] == prior_confidence.shape, 'prior_confidence must be 2D matrix with height and width equal to image.'
    assert (consts_map is None) or image.shape[:2] == consts_map.shape, 'consts_map must be 2D matrix with height and width equal to image.'
    
    laplacian = compute_laplacian(image, ~consts_map if consts_map is not None else None)
    confidence = scipy.sparse.diags(prior_confidence.ravel())
    solution = scipy.sparse.linalg.spsolve(
        laplacian + confidence,
        prior.ravel() * prior_confidence.ravel()
    )
    alpha = np.minimum(np.maximum(solution.reshape(prior.shape), 0), 1)
    return alpha

def closed_form_matting_with_trimap(image, trimap, trimap_confidence=100.0):
    """Apply Closed-Form matting to given image using trimap."""
    assert image.shape[:2] == trimap.shape, 'trimap must be 2D matrix with height and width equal to image.'
    consts_map = (trimap < 0.1) | (trimap > 0.9)
    return closed_form_matting_with_prior(image, trimap, trimap_confidence * consts_map, consts_map)
