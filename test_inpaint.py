import cv2
import numpy as np
import time

img = np.zeros((1024, 1024, 3), dtype=np.uint8)
mask = np.ones((1024, 1024), dtype=np.uint8) * 255
mask[256:768, 256:768] = 0

t0 = time.time()
cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
print(time.time() - t0)
