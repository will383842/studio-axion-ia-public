import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
seg=vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=mpt.BaseOptions(model_asset_path="selfie_multiclass_256x256.tflite"),output_confidence_masks=True))
img=cv2.imread("gC.png").astype(np.float32)/255
h,w=img.shape[:2]
cm=seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor((img*255).astype(np.uint8),cv2.COLOR_BGR2RGB))).confidence_masks
m=cv2.resize(1-cm[0].numpy_view(),(w,h),interpolation=cv2.INTER_CUBIC)
# affinage du contour guide par l image (filtre guide maison) : le masque epouse les vrais bords (cheveux, oreilles)
def boite(x,r): return cv2.boxFilter(x,-1,(r,r))
def guide(I,p,r=41,eps=1e-3):
    mI=boite(I,r); mp_=boite(p,r); cov=boite(I*p,r)-mI*mp_; var=boite(I*I,r)-mI*mI
    a=cov/(var+eps); b=mp_-a*mI; return boite(a,r)*I+boite(b,r)
gris=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
m=np.clip(guide(gris,m),0,1); m=np.clip(guide(gris,m,r=15,eps=1e-4),0,1)
M=m[...,None]
# flou du fond SANS faire baver le sujet dedans (convolution normalisee sur les seuls pixels de fond)
fondmask=(1-M)**2
def flou_fond(s): return cv2.GaussianBlur(img*fondmask,(0,0),s)/(cv2.GaussianBlur(fondmask[...,0],(0,0),s)[...,None]+1e-4)
d=cv2.distanceTransform(((m<0.5)*255).astype(np.uint8),cv2.DIST_L2,5); d=np.clip(d/300,0,1)[...,None]
fond=flou_fond(6)*(1-d)+flou_fond(14)*d
fond=fond*0.80; g=fond.mean(2,keepdims=True); fond=g+(fond-g)*0.85; fond=fond*np.array([1.03,1.0,0.97])
sujet=img*np.array([0.98,1.0,1.02])
out=np.clip(sujet*M+fond*(1-M),0,1)
cv2.imwrite("profondeur2.png",(out*255).astype(np.uint8))
a=cv2.imread("gA.png"); c=(out*255).astype(np.uint8)
cv2.imwrite("profondeur2-comparaison.jpg",cv2.resize(np.hstack([a,c]),(1080,960)),[cv2.IMWRITE_JPEG_QUALITY,90])
z=np.hstack([a[250:850,250:850],c[250:850,250:850]]); cv2.imwrite("profondeur2-zoom.jpg",z,[cv2.IMWRITE_JPEG_QUALITY,90])
print("ok")
