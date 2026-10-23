import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
seg=vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=mpt.BaseOptions(model_asset_path="selfie_multiclass_256x256.tflite"),output_confidence_masks=True))
img=cv2.imread("gC.png").astype(np.float32)/255  # image deja debruitee et eclaircie
h,w=img.shape[:2]
cm=seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor((img*255).astype(np.uint8),cv2.COLOR_BGR2RGB))).confidence_masks
m=cv2.resize(1-cm[0].numpy_view(),(w,h)); m=cv2.GaussianBlur(np.clip((m-0.5)*3+0.5,0,1),(0,0),2.5)
# profondeur : flou progressif du fond (plus loin du sujet = plus flou)
d=cv2.distanceTransform(((m<0.5)*255).astype(np.uint8),cv2.DIST_L2,5); d=np.clip(d/250,0,1)[...,None]
b1=cv2.GaussianBlur(img,(0,0),9); b2=cv2.GaussianBlur(img,(0,0),22)
fond=b1*(1-d)+b2*d
fond=fond*0.62; g=fond.mean(2,keepdims=True); fond=g+(fond-g)*0.7; fond=fond*np.array([1.06,1.0,0.94])  # plus sombre, desature, refroidi (BGR)
# liseré de lumière (contre-jour virtuel) sur le contour haut du sujet
bord=np.clip(cv2.GaussianBlur(m,(0,0),7)-cv2.GaussianBlur(cv2.erode(m,np.ones((15,15))),(0,0),7),0,1)
haut=np.linspace(1,0.15,h)[:,None]; bord=(bord*haut)[...,None]
sujet=img*np.array([0.97,1.0,1.04])  # peau un peu plus chaude
out=sujet*m[...,None]+fond*(1-m[...,None])+bord*np.array([0.55,0.75,0.95])*0.55
out=np.clip(out,0,1)
cv2.imwrite("profondeur.png",(out*255).astype(np.uint8))
a=cv2.imread("gA.png"); c=(out*255).astype(np.uint8)
cv2.imwrite("profondeur-comparaison.jpg",cv2.resize(np.hstack([a,c]),(1080,960)),[cv2.IMWRITE_JPEG_QUALITY,88])
print("ok")
