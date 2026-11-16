import { describe, expect, it } from "vitest";
import { argumentsExport, reglagesVideo } from "../../studio-rendu/src/composition/ffmpeg";
import { REGLAGES_RECOLLABLES, argumentsRecollables } from "../../studio-rendu/src/composition/reglages-recollables";

// G11-03 : option d'export « recollable », éteinte. Témoins = valeurs calculées sur `master` b359fb8d AVANT la fiche
// (formes de `ParametresExport` prises dans tests/m4b-montage.test.ts et tests/facecam-pre-cadre.test.ts).
// Règle 1 : option absente ou fausse = tableau identique au caractère près.
const TEMOINS_REGLAGES: { e: any; r: string }[] = [
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "mode": "crf",
   "crf": 17
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -crf 17 -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "mode": "crf"
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -crf 17 -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "mode": "2-passes"
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 30,
   "debitKbps": 9000,
   "debitMaxKbps": 12000,
   "audioKbps": 256,
   "audioHz": 48000
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 9000k -maxrate 12000k -bufsize 18000k -g 60 -keyint_min 60 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 30 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 24,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "mode": "crf",
   "crf": 20
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -crf 20 -maxrate 16000k -bufsize 24000k -g 48 -keyint_min 48 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 24 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "source10bits": true
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv:aq-mode=3 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "source10bits": true,
   "mode": "crf",
   "crf": 16
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -crf 16 -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv:aq-mode=3 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "conversionRvbSure": true
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "finPropre": {
    "dureeSec": 30,
    "tenueSec": 1,
    "fonduSec": 0.5,
    "couleur": "black"
   }
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 60,
   "debitKbps": 20000,
   "debitMaxKbps": 24000,
   "audioKbps": 256,
   "audioHz": 48000
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 20000k -maxrate 24000k -bufsize 36000k -g 120 -keyint_min 120 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 60 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 128,
   "audioHz": 44100,
   "mode": "crf",
   "crf": 23
  },
  "r": "-c:v libx264 -preset faster -profile:v high -level:v 4.1 -crf 23 -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv"
 }
];
const TEMOINS_EXPORT: { e: any; p1: string; p2: string }[] = [
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "mode": "crf",
   "crf": 17
  },
  "p1": "",
  "p2": "-hide_banner -y -i m.mov -f concat -safe 0 -i t.txt -filter_complex [0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp[m];[1:v]format=gbrap[t];[m][t]overlay=format=gbrp:eof_action=pass[o];[o]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v] -map [v] -map 0:a:0 -c:v libx264 -preset faster -profile:v high -level:v 4.1 -crf 17 -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart -shortest v.mp4"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000
  },
  "p1": "-hide_banner -y -i m.mov -f concat -safe 0 -i t.txt -filter_complex [0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp[m];[1:v]format=gbrap[t];[m][t]overlay=format=gbrp:eof_action=pass[o];[o]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v] -map [v] -c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -pass 1 -passlogfile j -an -f null -",
  "p2": "-hide_banner -y -i m.mov -f concat -safe 0 -i t.txt -filter_complex [0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp[m];[1:v]format=gbrap[t];[m][t]overlay=format=gbrp:eof_action=pass[o];[o]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v] -map [v] -map 0:a:0 -c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -pass 2 -passlogfile j -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart -shortest v.mp4"
 },
 {
  "e": {
   "fps": 25,
   "debitKbps": 14000,
   "debitMaxKbps": 16000,
   "audioKbps": 256,
   "audioHz": 48000,
   "source10bits": true
  },
  "p1": "-hide_banner -y -i m.mov -f concat -safe 0 -i t.txt -filter_complex [0:v]format=yuv444p10le[m];[1:v]format=gbrap,scale=out_color_matrix=bt709:out_range=tv,format=yuva444p10le[t];[m][t]overlay=format=yuv444p10:eof_action=pass[o];[o]scale=out_color_matrix=bt709:out_range=tv:sws_dither=ed,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v] -map [v] -c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv:aq-mode=3 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -pass 1 -passlogfile j -an -f null -",
  "p2": "-hide_banner -y -i m.mov -f concat -safe 0 -i t.txt -filter_complex [0:v]format=yuv444p10le[m];[1:v]format=gbrap,scale=out_color_matrix=bt709:out_range=tv,format=yuva444p10le[t];[m][t]overlay=format=yuv444p10:eof_action=pass[o];[o]scale=out_color_matrix=bt709:out_range=tv:sws_dither=ed,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v] -map [v] -map 0:a:0 -c:v libx264 -preset faster -profile:v high -level:v 4.1 -b:v 14000k -maxrate 16000k -bufsize 24000k -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 2 -pix_fmt yuv420p -r 25 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv:aq-mode=3 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -pass 2 -passlogfile j -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart -shortest v.mp4"
 }
];

describe("G11-03 · éteint = identique", () => {
  TEMOINS_REGLAGES.forEach(({ e, r }, i) => {
    it(`reglagesVideo identique au témoin ${i}`, () => {
      expect(reglagesVideo(e).join(" ")).toBe(r);
      expect(reglagesVideo(e, undefined).join(" ")).toBe(r);
      expect(reglagesVideo(e, {}).join(" ")).toBe(r);
      expect(reglagesVideo(e, { recollable: false }).join(" ")).toBe(r);
      expect(reglagesVideo(e)).toEqual(reglagesVideo(e, { recollable: false }));
    });
  });
  TEMOINS_EXPORT.forEach(({ e, p1, p2 }, i) => {
    it(`argumentsExport identique au témoin ${i}`, () => {
      const a = argumentsExport("m.mov", "t.txt", e, "j", "v.mp4");
      expect(a.passe1.join(" ")).toBe(p1);
      expect(a.passe2.join(" ")).toBe(p2);
    });
  });
});

describe("G11-03 · option allumée", () => {
  const e = { fps: 25, debitKbps: 14000, debitMaxKbps: 16000, audioKbps: 256, audioHz: 48000 };
  const compte = (t: string[], o: string) => t.filter((x) => x === o).length;
  it("pose chaque réglage une seule fois, valeurs explicites", () => {
    const r = reglagesVideo(e, { recollable: true });
    for (const [option] of REGLAGES_RECOLLABLES) expect(compte(r, option)).toBe(1);
    expect(r[r.indexOf("-video_track_timescale") + 1]).toBe("12800");
    expect(r[r.indexOf("-fps_mode") + 1]).toBe("cfr");
    expect(r.join(" ").startsWith(reglagesVideo(e).join(" "))).toBe(true);
  });
  it("argumentsRecollables est pure, n'altère pas l'entrée et ne double rien", () => {
    const base = reglagesVideo(e);
    const copie = [...base];
    const une = argumentsRecollables(base);
    expect(base).toEqual(copie);
    expect(argumentsRecollables(base)).toEqual(une);
    expect(argumentsRecollables(une)).toEqual(une);
  });
  it("remplace un réglage déjà présent au lieu de le doubler", () => {
    const r = argumentsRecollables(["-refs", "9", "-threads", "2"]);
    expect(compte(r, "-refs")).toBe(1);
    expect(compte(r, "-threads")).toBe(1);
  });
  it("l'export réel ne les passe pas (éteint)", () => {
    const a = argumentsExport("m.mov", "t.txt", e, "j", "v.mp4");
    expect(a.passe2.includes("-video_track_timescale")).toBe(false);
  });
});
