'''
THIS COMES FROM THE PYTHON REMBG MODULE - THIS IS NOT APART OF THE PROJECT

'''


from enum import Enum

import numpy as np
import onnxruntime as ort
from cv2 import (
    MORPH_ELLIPSE,
    getStructuringElement,
)
from PIL import Image
from PIL.Image import Image as PILImage
from pymatting.alpha.estimate_alpha_cf import estimate_alpha_cf
from pymatting.foreground.estimate_foreground_ml import estimate_foreground_ml
from pymatting.util.util import stack_images
from scipy.ndimage import binary_erosion



ort.set_default_logger_severity(3)

kernel = getStructuringElement(MORPH_ELLIPSE, (3, 3))


class ReturnType(Enum):
    BYTES = 0
    PILLOW = 1
    NDARRAY = 2


def alpha_matting_cutout(
    img: PILImage,
    mask: PILImage,
    foreground_threshold: int,
    background_threshold: int,
    erode_structure_size: int,
) -> PILImage:
    """
    Perform alpha matting on an image using a given mask and threshold values.

    This function takes a PIL image `img` and a PIL image `mask` as input, along with
    the `foreground_threshold` and `background_threshold` values used to determine
    foreground and background pixels. The `erode_structure_size` parameter specifies
    the size of the erosion structure to be applied to the mask.

    The function returns a PIL image representing the cutout of the foreground object
    from the original image.
    """
    if img.mode == "RGBA" or img.mode == "CMYK":
        img = img.convert("RGB")

    img_array = np.asarray(img)
    mask_array = np.asarray(mask)

    is_foreground = mask_array > foreground_threshold
    is_background = mask_array < background_threshold

    structure = None
    if erode_structure_size > 0:
        structure = np.ones(
            (erode_structure_size, erode_structure_size), dtype=np.uint8
        )

    is_foreground = binary_erosion(is_foreground, structure=structure)
    is_background = binary_erosion(is_background, structure=structure, border_value=1)

    trimap = np.full(mask_array.shape, dtype=np.uint8, fill_value=128)
    trimap[is_foreground] = 255
    trimap[is_background] = 0

    img_normalized = img_array / 255.0
    trimap_normalized = trimap / 255.0

    alpha = estimate_alpha_cf(img_normalized, trimap_normalized)
    foreground = estimate_foreground_ml(img_normalized, alpha)
    cutout = stack_images(foreground, alpha)

    cutout = np.clip(cutout * 255, 0, 255).astype(np.uint8)
    cutout = Image.fromarray(cutout)

    return cutout

