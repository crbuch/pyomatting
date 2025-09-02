import numpy as np
import scipy.sparse
import cv2
from numpy.lib.stride_tricks import as_strided

# Simple cache for computed Laplacians to avoid recomputation for same-sized images
_laplacian_cache = {}

def _cache_key(shape, mask_shape=None, eps=1e-7, win_rad=1):
    """Generate cache key for Laplacian computation."""
    return (shape, mask_shape, eps, win_rad)

def _rolling_block(A, block=(3, 3)):
    """Applies sliding window to given matrix."""
    shape = (A.shape[0] - block[0] + 1, A.shape[1] - block[1] + 1) + block
    strides = (A.strides[0], A.strides[1]) + A.strides
    return as_strided(A, shape=shape, strides=strides)

def compute_laplacian(img, mask=None, eps=1e-7, win_rad=1):
    """Computes Matting Laplacian for a given image with memory optimization."""
    win_size = (win_rad * 2 + 1) ** 2
    h, w, d = img.shape
    c_h, c_w = h - 2 * win_rad, w - 2 * win_rad
    win_diam = win_rad * 2 + 1

    # Check cache first
    cache_key = _cache_key((h, w, d), mask.shape if mask is not None else None, eps, win_rad)
    if cache_key in _laplacian_cache:
        return _laplacian_cache[cache_key]

    indsM = np.arange(h * w).reshape((h, w))
    win_inds = _rolling_block(indsM, block=(win_diam, win_diam))
    win_inds = win_inds.reshape(c_h, c_w, win_size)
    
    if mask is not None:
        mask = cv2.dilate(
            mask.astype(np.uint8),
            np.ones((win_diam, win_diam), np.uint8)
        ).astype(bool)
        win_mask = np.sum(mask.ravel()[win_inds], axis=2)
        win_inds = win_inds[win_mask > 0, :]
    else:
        win_inds = win_inds.reshape(-1, win_size)

    # Process in chunks to reduce memory usage for large images
    chunk_size = min(10000, len(win_inds))  # Adaptive chunk size
    
    rows, cols, vals = [], [], []
    
    # Reshape image data once
    ravelImg = img.reshape(h * w, d)
    
    for start_idx in range(0, len(win_inds), chunk_size):
        end_idx = min(start_idx + chunk_size, len(win_inds))
        chunk_inds = win_inds[start_idx:end_idx]
        
        winI = ravelImg[chunk_inds]
        win_mu = np.mean(winI, axis=1, keepdims=True)
        win_var = np.einsum('...ji,...jk ->...ik', winI, winI) / win_size - np.einsum('...ji,...jk ->...ik', win_mu, win_mu)

        A = win_var + (eps/win_size)*np.eye(3)
        B = (winI - win_mu).transpose(0, 2, 1)
        
        # Use more stable solve
        try:
            X = np.linalg.solve(A, B).transpose(0, 2, 1)
        except np.linalg.LinAlgError:
            # Fallback to pseudo-inverse for singular matrices
            X = np.linalg.pinv(A) @ B
            X = X.transpose(0, 2, 1)
        
        chunk_vals = np.eye(win_size) - (1.0/win_size)*(1 + X @ B)

        chunk_rows = np.repeat(chunk_inds, win_size).ravel()
        chunk_cols = np.tile(chunk_inds, win_size).ravel()
        
        rows.append(chunk_rows)
        cols.append(chunk_cols)
        vals.append(chunk_vals.ravel())
    
    # Combine all chunks
    nz_indsRow = np.concatenate(rows)
    nz_indsCol = np.concatenate(cols)
    nz_indsVal = np.concatenate(vals)
    
    L = scipy.sparse.coo_matrix((nz_indsVal, (nz_indsRow, nz_indsCol)), shape=(h*w, h*w))
    
    # Convert to CSR format for efficient indexing and operations
    L = L.tocsr()
    
    # Cache the result (but limit cache size to prevent memory bloat)
    if len(_laplacian_cache) < 5:  # Limit cache size
        _laplacian_cache[cache_key] = L
    
    return L