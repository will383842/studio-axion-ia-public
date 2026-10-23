import cv2, numpy as np, urllib.request, os, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
M="face_landmarker.task"
if not os.path.exists(M): urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",M)
fl=vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=M),num_faces=1))
img=cv2.imread("gC.png"); h,w=img.shape[:2]
res=fl.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB)))
P=np.array([[l.x*w,l.y*h] for l in res.face_landmarks[0]],np.float32)
OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
OEIL_G=[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]; OEIL_D=[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]
BOUCHE=[61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185]
SOURC_G=[70,63,105,66,107,55,65,52,53,46]; SOURC_D=[300,293,334,296,336,285,295,282,283,276]
def poly(idx,dil=0,flou=0):
    m=np.zeros((h,w),np.float32); cv2.fillPoly(m,[P[idx].astype(np.int32)],1.0)
    if dil: m=cv2.dilate(m,np.ones((dil,dil)))
    return cv2.GaussianBlur(m,(0,0),flou) if flou else m
yeux=np.maximum(poly(OEIL_G,9),poly(OEIL_D,9)); trous=np.clip(yeux+poly(BOUCHE,11)+poly(SOURC_G,9)+poly(SOURC_D,9),0,1)
peau=np.clip(poly(OVAL,0)-trous,0,1); peau=cv2.GaussianBlur(peau,(0,0),9)
# cernes : bande sous chaque oeil
cerne=np.zeros((h,w),np.float32)
for idx in (OEIL_G,OEIL_D):
    e=P[idx]; x0,x1=e[:,0].min(),e[:,0].max(); yb=e[:,1].max(); hh=(e[:,1].max()-e[:,1].min())
    cv2.ellipse(cerne,(int((x0+x1)/2),int(yb+hh*0.9)),(int((x1-x0)*0.48),int(hh*0.85)),0,0,360,1.0,-1)
cerne=cv2.GaussianBlur(cerne*(1-cv2.GaussianBlur(yeux,(0,0),3)),(0,0),7)
f=img.astype(np.float32)/255
# 1) peau lissee legerement (frequences : on garde le detail fin a 70 %)
lisse=cv2.bilateralFilter(img,9,40,9).astype(np.float32)/255
detail=f-cv2.GaussianBlur(f,(0,0),2); douce=cv2.GaussianBlur(lisse,(0,0),2)+detail*0.75
f2=f*(1-peau[...,None]*0.55)+douce*(peau[...,None]*0.55)
# 2) teint : plus lumineux, plus chaud, un peu plus colore (bonne mine)
hsv=cv2.cvtColor(np.clip(f2,0,1),cv2.COLOR_BGR2HSV)
hsv[...,1]=hsv[...,1]*(1+0.18*peau); hsv[...,2]=np.clip(hsv[...,2]*(1+0.07*peau),0,1)
f3=cv2.cvtColor(hsv,cv2.COLOR_HSV2BGR)
f3=f3*(1+peau[...,None]*np.array([-0.03,0.0,0.045]))
# 3) cernes eclaircies et moins violettes
c=cerne[...,None]; f3=f3*(1+0.13*c); g=f3.mean(2,keepdims=True); f3=f3*(1-0.25*c)+(g*np.array([0.97,1.0,1.04]))*0.25*c
# 4) regard : yeux tres legerement plus clairs et contrastes
ye=cv2.GaussianBlur(yeux,(0,0),2)[...,None]; f3=f3*(1+0.06*ye)
out=(np.clip(f3,0,1)*255).astype(np.uint8)
a=cv2.imread("gA.png")
z=lambda x:x[300:900,240:840]
cv2.imwrite("bonnemine-zoom.jpg",np.hstack([z(a),z(img),z(out)]),[cv2.IMWRITE_JPEG_QUALITY,90])
cv2.imwrite("bonnemine.png",out); print("ok")
