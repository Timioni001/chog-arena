import numpy as np, onnxruntime as ort, os, sys, time
from PIL import Image
_s = None
def sess():
    global _s
    if _s is None:
        o = ort.SessionOptions(); o.intra_op_num_threads = 0
        _s = ort.InferenceSession(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'esrgan.onnx'), o)
    return _s
def upscale4(img, T=64, P=6):
    s = sess(); name = s.get_inputs()[0].name
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255.0
    h, w, _ = a.shape
    step = T - 2 * P
    nh = ((h + step - 1) // step); nw = ((w + step - 1) // step)
    pad = np.pad(a, ((P, nh * step - h + P), (P, nw * step - w + P), (0, 0)), mode='reflect')
    out = np.zeros((nh * step * 4, nw * step * 4, 3), np.float32)
    for i in range(nh):
        for j in range(nw):
            t = pad[i*step:i*step+T, j*step:j*step+T].transpose(2, 0, 1)[None]
            r = s.run(None, {name: t})[0][0].transpose(1, 2, 0)
            out[i*step*4:(i+1)*step*4, j*step*4:(j+1)*step*4] = r[P*4:P*4+step*4, P*4:P*4+step*4]
    out = np.clip(out[:h*4, :w*4], 0, 1)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8))
if __name__ == '__main__':
    im = Image.open(sys.argv[1]).convert('RGB').crop((0, 0, 200, 200))
    t = time.time(); r = upscale4(im); print(r.size, time.time() - t)
    r.save('test-up.png')
