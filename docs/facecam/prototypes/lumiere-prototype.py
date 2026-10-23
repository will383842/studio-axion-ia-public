import cv2, numpy as np, urllib.request, os, sys
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
M1="selfie_multiclass_256x256.tflite"; M2="blaze_face_short_range.tflite"
if not os.path.exists(M1): urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",M1)
if not os.path.exists(M2): urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",M2)
seg=vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=mpt.BaseOptions(model_asset_path=M1),output_category_mask=False,output_confidence_masks=True))
fd=vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(base_options=mpt.BaseOptions(model_asset_path=M2)))
src,dst,debut,duree=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4])
cap=cv2.VideoCapture(src); cap.set(cv2.CAP_PROP_POS_MSEC,debut*1000)
fps=cap.get(cv2.CAP_PROP_FPS) or 25; n=int(duree*fps)
X0,W=1140,1216
out=cv2.VideoWriter(dst,cv2.VideoWriter_fourcc(*"mp4v"),fps,(1080,1920))
mask_prev=None; face_prev=None
for i in range(n):
    ok,f=cap.read()
    if not ok: break
    f=cv2.rotate(f,cv2.ROTATE_180) if f[0:50].mean()<0 else f
    c=f[:,X0:X0+W]; c=cv2.resize(c,(1080,1920),interpolation=cv2.INTER_LANCZOS4)
    rgb=cv2.cvtColor(c,cv2.COLOR_BGR2RGB); small=cv2.resize(rgb,(540,960))
    im=mp.Image(image_format=mp.ImageFormat.SRGB,data=small)
    cm=seg.segment(im).confidence_masks
    person=1.0-cm[0].numpy_view()  # 0 = fond
    skin=cm[2].numpy_view()+cm[3].numpy_view()  # peau corps + visage
    person=cv2.resize(person,(1080,1920)); skin=cv2.resize(skin,(1080,1920))
    person=cv2.GaussianBlur(person,(0,0),6)
    mask_prev=person if mask_prev is None else 0.6*mask_prev+0.4*person
    det=fd.detect(im).detections
    if det:
        b=det[0].bounding_box; fc=np.array([ (b.origin_x+b.width/2)*2,(b.origin_y+b.height/2)*2, b.width*2])
        face_prev=fc if face_prev is None else 0.85*face_prev+0.15*fc
    h,w=1920,1080; yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    cx,cy,fw=face_prev if face_prev is not None else (540,700,300)
    # lumière principale : source en haut à gauche du visage, très douce
    lx,ly,r=cx-0.35*fw,cy-0.25*fw,fw*2.2
    key=np.exp(-(((xx-lx)**2+(yy-ly)**2)/(2*r*r)))
    f32=c.astype(np.float32)/255.0
    lin=f32**2.2
    gain=1.0+0.55*key*mask_prev                       # éclaire le sujet
    bg=1.0-0.28*(1.0-mask_prev)                       # assombrit le fond
    lin=lin*gain[...,None]*bg[...,None]
    sk=cv2.GaussianBlur(skin,(0,0),4)[...,None]*0.5
    lin=lin*(1+sk*np.array([-0.04,0.0,0.05]))         # peau légèrement réchauffée (BGR)
    o=np.clip(lin,0,1)**(1/2.2)
    out.write((o*255).astype(np.uint8))
out.release(); print("ok",i+1)
