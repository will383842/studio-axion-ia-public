/**
 * C6-H24a · filet de H24c : les arguments FFmpeg ACTUELS de `argumentsImageFfmpeg` (`image-ffmpeg.ts:204`) sont figés,
 * caractère pour caractère, pour des vidéos où des illustrations alternent avec le double : la ligne `concat=n=…`
 * (`image-ffmpeg.ts:367`) et le graphe complet, en 8 bits et en 10 bits (`ffmpeg.ts:44-46`, `chaineCouleurs`).
 * Quand H24c ajoutera un raccord fondu (éteint par défaut), ces arguments ne doivent PAS changer tant que rien n'est allumé.
 * Test pur (aucun FFmpeg lancé). Constat : aucun code de production touché.
 */
import { describe, expect, it } from "vitest";
import type { ProprietesImageComposition } from "../../src/briques/composition/scene";
import { argumentsImageFfmpeg, morceaux } from "../../studio-rendu/src/composition/image-ffmpeg";
import { plansZoomEtCarte } from "../../studio-rendu/src/controle-ffmpeg";

const CADRAGE = { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 };
const COULEURS = { grainPct: 4, grainTaillePx: 2, vignettePct: 8 };

/** Avocat (plans de `tests/m4b-montage.test.ts:81-87`, plan 3 en illustration), 9:16, 10 s. */
const avocat = (dixBits: boolean) =>
  ({
    ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 250,
    decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
    doubles: { principal: { type: "video", url: "entree:double", transparent: true } },
    ...(dixBits ? { source10bits: true } : {}),
    plans: [
      { debutSec: 0, finSec: 2.26, type: "double", angle: "principal", cadrage: CADRAGE },
      { debutSec: 2.26, finSec: 3.96, type: "double", angle: "principal", cadrage: { ...CADRAGE, valeur: "poitrine", zoom: 1.2, zoomFin: 1.2 } },
      { debutSec: 3.96, finSec: 6, type: "illustration", angle: "principal", cadrage: CADRAGE, illustration: { url: "entree:illu-02", video: false } },
      { debutSec: 6, finSec: 8.5, type: "double", angle: "principal", cadrage: CADRAGE },
      { debutSec: 8.5, finSec: 10, type: "double", angle: "principal", cadrage: { ...CADRAGE, valeur: "poitrine", zoom: 1.2, zoomFin: 1.2 } },
    ],
  }) as unknown as ProprietesImageComposition;

/** Face caméra (source pré-cadrée) : double / carte plein écran / double serré (`plansZoomEtCarte`). */
const facecam = (dixBits: boolean) =>
  ({
    ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 25,
    decor: { teinte: "#16120F", directionLumiere: "face", flouPx: 0, clair: false },
    sourcePreCadree: true,
    ...(dixBits ? { source10bits: true } : {}),
    doubles: { principal: { type: "video", url: "entree:double-principal", transparent: false } },
    plans: plansZoomEtCarte(1),
  }) as unknown as ProprietesImageComposition;

const FICHIERS_AVOCAT = { decor: "decor-pret.png", doubles: { principal: { fichier: "double.webm", video: true } }, accessoire: { fichier: "accessoire.png", x: 700, y: 560, largeur: 260, hauteur: 1380 }, illustrations: { 2: { fichier: "illu-02.jpg", video: false } }, luts: [{ fichier: "lut.cube", plages: [[0, 10]] as [number, number][] }], son: "son.wav" };
const FICHIERS_FACECAM = { doubles: { principal: { fichier: "montage.mov", video: true } }, illustrations: { 1: { fichier: "carte.mp4", video: true } }, luts: [], son: "voix.wav" };

const CAS = {
  "avocat 8 bits": () => argumentsImageFfmpeg(avocat(false), COULEURS, FICHIERS_AVOCAT, 10, "master.mov"),
  "avocat 10 bits": () => argumentsImageFfmpeg(avocat(true), COULEURS, FICHIERS_AVOCAT, 10, "master.mov"),
  "face caméra carte 8 bits": () => argumentsImageFfmpeg(facecam(false), COULEURS, FICHIERS_FACECAM, 1, "master.mov", { fils: 2 }),
  "face caméra carte 10 bits": () => argumentsImageFfmpeg(facecam(true), COULEURS, FICHIERS_FACECAM, 1, "master.mov", { fils: 2 }),
} as const;

/** Arguments FFmpeg relevés sur master le jour de H24a (valeurs exactes). */
const FIGE: Record<keyof typeof CAS, string[]> = {
  "avocat 8 bits": [
    "-hide_banner",
    "-y",
    "-i",
    "decor-pret.png",
    "-c:v",
    "libvpx-vp9",
    "-i",
    "double.webm",
    "-i",
    "accessoire.png",
    "-i",
    "illu-02.jpg",
    "-i",
    "son.wav",
    "-filter_complex",
    "[0:v]loop=loop=-1:size=1,settb=1/25,setpts=N,trim=end_frame=252,format=gbrp,setsar=1,split=4[dec0][dec1][dec2][dec3];\n[1:v]fps=25,scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=gbrap,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,tpad=stop_mode=clone:stop_duration=10.080,split=4[dp0][dp1][dp2][dp3];\n[2:v]loop=loop=-1:size=1,settb=1/25,setpts=N,trim=end_frame=252,format=gbrap,setsar=1,split=4[acc0][acc1][acc2][acc3];\n[dec0]trim=start_frame=0:end_frame=57,setpts=PTS-STARTPTS[b0];\n[dp0]trim=start_frame=0:end_frame=57,setpts=PTS-STARTPTS[d0];\n[b0][d0]overlay=x=0:y=0:format=gbrp[e0];\n[acc0]trim=start_frame=0:end_frame=57,setpts=PTS-STARTPTS[a0];\n[e0][a0]overlay=x=700:y=560:format=gbrp[f0];\n[f0]format=gbrp,setsar=1[m0];\n[dec1]trim=start_frame=57:end_frame=99,setpts=PTS-STARTPTS[b1];\n[dp1]trim=start_frame=57:end_frame=99,setpts=PTS-STARTPTS[d1];\n[b1][d1]overlay=x=0:y=0:format=gbrp[e1];\n[acc1]trim=start_frame=57:end_frame=99,setpts=PTS-STARTPTS[a1];\n[e1][a1]overlay=x=700:y=560:format=gbrp[f1];\n[f1]crop=900:1600:90:0,scale=1080:1920:flags=lanczos,format=gbrp,setsar=1[m1];\ncolor=c=black:s=1080x1920:r=25,format=gbrp,trim=end_frame=51,setpts=PTS-STARTPTS[n2];\n[3:v]loop=loop=-1:size=1,settb=1/25,setpts=N,trim=end_frame=53,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,format=gbrap,setsar=1,tpad=stop_mode=clone:stop_duration=2.120,trim=end_frame=51,setpts=PTS-STARTPTS[i2];\n[n2][i2]overlay=x=0:y=0:format=gbrp,format=gbrp,setsar=1[m2];\n[dec2]trim=start_frame=150:end_frame=213,setpts=PTS-STARTPTS[b3];\n[dp2]trim=start_frame=150:end_frame=213,setpts=PTS-STARTPTS[d3];\n[b3][d3]overlay=x=0:y=0:format=gbrp[e3];\n[acc2]trim=start_frame=150:end_frame=213,setpts=PTS-STARTPTS[a3];\n[e3][a3]overlay=x=700:y=560:format=gbrp[f3];\n[f3]format=gbrp,setsar=1[m3];\n[dec3]trim=start_frame=213:end_frame=250,setpts=PTS-STARTPTS[b4];\n[dp3]trim=start_frame=213:end_frame=250,setpts=PTS-STARTPTS[d4];\n[b4][d4]overlay=x=0:y=0:format=gbrp[e4];\n[acc3]trim=start_frame=213:end_frame=250,setpts=PTS-STARTPTS[a4];\n[e4][a4]overlay=x=700:y=560:format=gbrp[f4];\n[f4]crop=900:1600:90:0,scale=1080:1920:flags=lanczos,format=gbrp,setsar=1[m4];\n[m0][m1][m2][m3][m4]concat=n=5:v=1:a=0,format=gbrp[img];\n[img]format=gbrp,lut3d=file=lut.cube:interp=tetrahedral:enable='gte(t\\,0.000)*lt(t\\,10.000)',scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,vignette=angle=0.2035:eval=init[img_c];color=c=0x808080:s=540x960:r=25:d=10.080,format=yuv420p,noise=c0s=10:c0f=t+u,scale=1080:1920:flags=bicubic,format=yuv420p[grain];[img_c][grain]blend=c0_mode=overlay:c1_expr=A:c2_expr=A:shortest=1,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]",
    "-map",
    "[v]",
    "-map",
    "4:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "12",
    "-pix_fmt",
    "yuv420p",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-af",
    "pan=stereo|c0=0.7071*c0|c1=0.7071*c0",
    "-c:a",
    "pcm_s24le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "master.mov",
  ],
  "avocat 10 bits": [
    "-hide_banner",
    "-y",
    "-i",
    "decor-pret.png",
    "-c:v",
    "libvpx-vp9",
    "-i",
    "double.webm",
    "-i",
    "accessoire.png",
    "-i",
    "illu-02.jpg",
    "-i",
    "son.wav",
    "-filter_complex",
    "[0:v]loop=loop=-1:size=1,settb=1/25,setpts=N,trim=end_frame=252,format=gbrp10le,setsar=1,split=4[dec0][dec1][dec2][dec3];\n[1:v]fps=25,scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=gbrap10le,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,tpad=stop_mode=clone:stop_duration=10.080,split=4[dp0][dp1][dp2][dp3];\n[2:v]loop=loop=-1:size=1,settb=1/25,setpts=N,trim=end_frame=252,format=gbrap10le,setsar=1,split=4[acc0][acc1][acc2][acc3];\n[dec0]trim=start_frame=0:end_frame=57,setpts=PTS-STARTPTS[b0];\n[dp0]trim=start_frame=0:end_frame=57,setpts=PTS-STARTPTS[d0];\n[b0][d0]overlay=x=0:y=0:format=yuv444p10[e0];\n[acc0]trim=start_frame=0:end_frame=57,setpts=PTS-STARTPTS[a0];\n[e0][a0]overlay=x=700:y=560:format=yuv444p10[f0];\n[f0]format=gbrp10le,setsar=1[m0];\n[dec1]trim=start_frame=57:end_frame=99,setpts=PTS-STARTPTS[b1];\n[dp1]trim=start_frame=57:end_frame=99,setpts=PTS-STARTPTS[d1];\n[b1][d1]overlay=x=0:y=0:format=yuv444p10[e1];\n[acc1]trim=start_frame=57:end_frame=99,setpts=PTS-STARTPTS[a1];\n[e1][a1]overlay=x=700:y=560:format=yuv444p10[f1];\n[f1]crop=900:1600:90:0,scale=1080:1920:flags=lanczos,format=gbrp10le,setsar=1[m1];\ncolor=c=black:s=1080x1920:r=25,format=gbrp10le,trim=end_frame=51,setpts=PTS-STARTPTS[n2];\n[3:v]loop=loop=-1:size=1,settb=1/25,setpts=N,trim=end_frame=53,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,format=gbrap10le,setsar=1,tpad=stop_mode=clone:stop_duration=2.120,trim=end_frame=51,setpts=PTS-STARTPTS[i2];\n[n2][i2]overlay=x=0:y=0:format=yuv444p10,format=gbrp10le,setsar=1[m2];\n[dec2]trim=start_frame=150:end_frame=213,setpts=PTS-STARTPTS[b3];\n[dp2]trim=start_frame=150:end_frame=213,setpts=PTS-STARTPTS[d3];\n[b3][d3]overlay=x=0:y=0:format=yuv444p10[e3];\n[acc2]trim=start_frame=150:end_frame=213,setpts=PTS-STARTPTS[a3];\n[e3][a3]overlay=x=700:y=560:format=yuv444p10[f3];\n[f3]format=gbrp10le,setsar=1[m3];\n[dec3]trim=start_frame=213:end_frame=250,setpts=PTS-STARTPTS[b4];\n[dp3]trim=start_frame=213:end_frame=250,setpts=PTS-STARTPTS[d4];\n[b4][d4]overlay=x=0:y=0:format=yuv444p10[e4];\n[acc3]trim=start_frame=213:end_frame=250,setpts=PTS-STARTPTS[a4];\n[e4][a4]overlay=x=700:y=560:format=yuv444p10[f4];\n[f4]crop=900:1600:90:0,scale=1080:1920:flags=lanczos,format=gbrp10le,setsar=1[m4];\n[m0][m1][m2][m3][m4]concat=n=5:v=1:a=0,format=gbrp10le[img];\n[img]format=gbrp10le,lut3d=file=lut.cube:interp=tetrahedral:enable='gte(t\\,0.000)*lt(t\\,10.000)',scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le,vignette=angle=0.2035:eval=init[img_c];color=c=0x808080:s=540x960:r=25:d=10.080,format=yuv420p,noise=c0s=10:c0f=t+u,scale=1080:1920:flags=bicubic,format=yuv420p10le[grain];[img_c][grain]blend=c0_mode=overlay:c1_expr=A:c2_expr=A:shortest=1,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]",
    "-map",
    "[v]",
    "-map",
    "4:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "8",
    "-pix_fmt",
    "yuv420p10le",
    "-profile:v",
    "high10",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-af",
    "pan=stereo|c0=0.7071*c0|c1=0.7071*c0",
    "-c:a",
    "pcm_s24le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "master.mov",
  ],
  "face caméra carte 8 bits": [
    "-hide_banner",
    "-y",
    "-filter_complex_threads",
    "2",
    "-i",
    "montage.mov",
    "-i",
    "carte.mp4",
    "-i",
    "voix.wav",
    "-filter_complex",
    "color=c=0x16120F:s=1080x1920:r=25:d=1.080,format=gbrp,setsar=1,split=2[dec0][dec1];\n[0:v]fps=25,scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=gbrap,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,tpad=stop_mode=clone:stop_duration=1.080,split=2[dp0][dp1];\n[dec0]trim=start_frame=0:end_frame=10,setpts=PTS-STARTPTS[b0];\n[dp0]trim=start_frame=0:end_frame=10,setpts=PTS-STARTPTS[d0];\n[b0][d0]overlay=x=0:y=0:format=gbrp[e0];\n[e0]format=gbrp,setsar=1[m0];\ncolor=c=black:s=1080x1920:r=25,format=gbrp,trim=end_frame=5,setpts=PTS-STARTPTS[n1];\n[1:v]fps=25,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos:in_color_matrix=bt709:in_range=tv,crop=1080:1920,format=gbrap,setsar=1,tpad=stop_mode=clone:stop_duration=0.280,trim=end_frame=5,setpts=PTS-STARTPTS[i1];\n[n1][i1]overlay=x=0:y=0:format=gbrp,format=gbrp,setsar=1[m1];\n[dec1]trim=start_frame=15:end_frame=25,setpts=PTS-STARTPTS[b2];\n[dp1]trim=start_frame=15:end_frame=25,setpts=PTS-STARTPTS[d2];\n[b2][d2]overlay=x=0:y=0:format=gbrp[e2];\n[e2]crop=831:1477:125:0,scale=1080:1920:flags=lanczos,format=gbrp,setsar=1[m2];\n[m0][m1][m2]concat=n=3:v=1:a=0,format=gbrp[img];\n[img]format=gbrp,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,vignette=angle=0.2035:eval=init[img_c];color=c=0x808080:s=540x960:r=25:d=1.080,format=yuv420p,noise=c0s=10:c0f=t+u,scale=1080:1920:flags=bicubic,format=yuv420p[grain];[img_c][grain]blend=c0_mode=overlay:c1_expr=A:c2_expr=A:shortest=1,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]",
    "-map",
    "[v]",
    "-map",
    "2:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "12",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    "2",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-af",
    "pan=stereo|c0=0.7071*c0|c1=0.7071*c0",
    "-c:a",
    "pcm_s24le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "master.mov",
  ],
  "face caméra carte 10 bits": [
    "-hide_banner",
    "-y",
    "-filter_complex_threads",
    "2",
    "-i",
    "montage.mov",
    "-i",
    "carte.mp4",
    "-i",
    "voix.wav",
    "-filter_complex",
    "color=c=0x16120F:s=1080x1920:r=25:d=1.080,format=gbrp10le,setsar=1,split=2[dec0][dec1];\n[0:v]fps=25,scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=gbrap10le,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,tpad=stop_mode=clone:stop_duration=1.080,split=2[dp0][dp1];\n[dec0]trim=start_frame=0:end_frame=10,setpts=PTS-STARTPTS[b0];\n[dp0]trim=start_frame=0:end_frame=10,setpts=PTS-STARTPTS[d0];\n[b0][d0]overlay=x=0:y=0:format=yuv444p10[e0];\n[e0]format=gbrp10le,setsar=1[m0];\ncolor=c=black:s=1080x1920:r=25,format=gbrp10le,trim=end_frame=5,setpts=PTS-STARTPTS[n1];\n[1:v]fps=25,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos:in_color_matrix=bt709:in_range=tv,crop=1080:1920,format=gbrap10le,setsar=1,tpad=stop_mode=clone:stop_duration=0.280,trim=end_frame=5,setpts=PTS-STARTPTS[i1];\n[n1][i1]overlay=x=0:y=0:format=yuv444p10,format=gbrp10le,setsar=1[m1];\n[dec1]trim=start_frame=15:end_frame=25,setpts=PTS-STARTPTS[b2];\n[dp1]trim=start_frame=15:end_frame=25,setpts=PTS-STARTPTS[d2];\n[b2][d2]overlay=x=0:y=0:format=yuv444p10[e2];\n[e2]crop=831:1477:125:0,scale=1080:1920:flags=lanczos,format=gbrp10le,setsar=1[m2];\n[m0][m1][m2]concat=n=3:v=1:a=0,format=gbrp10le[img];\n[img]format=gbrp10le,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p10le,vignette=angle=0.2035:eval=init[img_c];color=c=0x808080:s=540x960:r=25:d=1.080,format=yuv420p,noise=c0s=10:c0f=t+u,scale=1080:1920:flags=bicubic,format=yuv420p10le[grain];[img_c][grain]blend=c0_mode=overlay:c1_expr=A:c2_expr=A:shortest=1,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]",
    "-map",
    "[v]",
    "-map",
    "2:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "8",
    "-pix_fmt",
    "yuv420p10le",
    "-profile:v",
    "high10",
    "-threads",
    "2",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-af",
    "pan=stereo|c0=0.7071*c0|c1=0.7071*c0",
    "-c:a",
    "pcm_s24le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "master.mov",
  ],
};

describe("C6-H24a · arguments FFmpeg figés (le filet que H24c devra garder vert)", () => {
  for (const nom of Object.keys(CAS) as (keyof typeof CAS)[]) {
    it(`${nom} : graphe complet et arguments identiques, caractère pour caractère`, () => {
      expect(CAS[nom]()).toEqual(FIGE[nom]);
    });
  }

  it("la ligne concat et les formats : 8 bits gbrp / 10 bits gbrp10le, un morceau par plan", () => {
    const graphe = (a: string[]) => a[a.indexOf("-filter_complex") + 1];
    const n = (p: ProprietesImageComposition) => morceaux(p.plans, p.images, p.fps).length;
    expect(graphe(CAS["avocat 8 bits"]())).toContain(`concat=n=${n(avocat(false))}:v=1:a=0,format=gbrp[img]`);
    expect(graphe(CAS["avocat 10 bits"]())).toContain(`concat=n=${n(avocat(true))}:v=1:a=0,format=gbrp10le[img]`);
    expect(graphe(CAS["face caméra carte 8 bits"]())).toContain("concat=n=3:v=1:a=0,format=gbrp[img]");
    expect(graphe(CAS["face caméra carte 10 bits"]())).toContain("concat=n=3:v=1:a=0,format=gbrp10le[img]");
    expect(CAS["avocat 10 bits"]()).toContain("yuv420p10le");
    expect(CAS["avocat 8 bits"]()).not.toContain("yuv420p10le");
  });
});
