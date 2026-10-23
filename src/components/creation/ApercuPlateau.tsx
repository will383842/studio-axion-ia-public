"use client";

/**
 * APERÇU DU PLATEAU (lot M3 ; plan PARTIE A §2 étape 2, B.9 « Aperçu du plateau »).
 * Composition CÔTÉ CLIENT, gratuite et instantanée : le double détouré (`Visage.detoureFichierId`) posé sur le décor
 * (image floutée ou teinte avec sa lueur), l'accessoire (micro, du côté du regard, flou), puis la LUT 3D appliquée par un
 * shader WebGL2 (texture 3D 33³ : copie d'aperçu binaire pour les LUT du studio, sinon le `.cube` réduit) avec son intensité. Repli sur le processeur si
 * WebGL2 manque. Sans image détourée : la vignette brute, adoucie sur ses bords, et l'écran le dit.
 * Le temps de composition est exposé (`data-duree-ms`) : il doit rester sous 1 s à 390 px (mesuré par le test e2e).
 */
import { useEffect, useRef, useState } from "react";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { cn } from "@/lib/cn";
import { appliquerLutPixels, donneesTexture3D, FRAGMENTS_LUT, lireCube, lireLutApercu, reduireLut, SOMMETS_LUT, urlApercuLut, type Lut3D } from "@/lib/lut3d";

export interface DecorPlateau {
  imageUrl?: string | null;
  teinte?: string;
  teinteLumiere?: string;
  /** Flou en px pour 1080 de large. */
  profondeurFlou: number;
  directionLumiere: "gauche" | "droite" | "face";
  positionSujet: number;
}

export interface ProprietesApercuPlateau {
  decor: DecorPlateau | null;
  /** Image détourée du double (PNG transparent). */
  detoureUrl?: string | null;
  /** Vignette brute du double, quand aucune image détourée n'existe. */
  vignetteUrl?: string | null;
  /** Micro posé du côté du regard (x, y en fraction, largeur en % de l'image). */
  micro?: { x: number; y: number; largeurPct: number; flouPx: number } | null;
  /** Fichier `.cube` de la LUT et intensité 0-100. */
  lut?: { url: string | null; intensite: number; nom?: string } | null;
  className?: string;
}

const LARGEUR = 360;
const HAUTEUR = 640;
const ECHELLE_1080 = LARGEUR / 1080;

/* --- Caches (une LUT et une image ne se chargent qu'une fois par page) --- */
const lutsChargees = new Map<string, Promise<Lut3D>>();
const imagesChargees = new Map<string, Promise<HTMLImageElement>>();
/** Aperçu rapide (02/10) : ce qui est DÉJÀ chargé, lisible sans attendre (composition immédiate à l'ouverture). */
const lutsPretes = new Map<string, Lut3D>();
const imagesPretes = new Map<string, HTMLImageElement>();

/** Le `.cube` complet (LUT importée) : lu puis réduit à 33³ dans le navigateur. */
function chargerCube(url: string): Promise<Lut3D> {
  return fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error("LUT introuvable");
      return r.text();
    })
    .then((t) => reduireLut(lireCube(t)));
}

/**
 * Aperçu rapide (02/10) : pour une LUT servie par le studio, la copie d'aperçu 33³ binaire (≈ 105 Ko au lieu de
 * 7,4 Mo de texte) ; le rendu final garde le `.cube` 65³. Copie absente ou illisible : le `.cube`, comme avant.
 */
function chargerLut(url: string): Promise<Lut3D> {
  let p = lutsChargees.get(url);
  if (!p) {
    const apercu = urlApercuLut(url);
    p = apercu
      ? fetch(apercu)
          .then((r) => {
            if (!r.ok) throw new Error("copie d'aperçu absente");
            return r.arrayBuffer();
          })
          .then(lireLutApercu)
          .catch(() => chargerCube(url))
      : chargerCube(url);
    p = p.then((l) => {
      lutsPretes.set(url, l);
      return l;
    });
    lutsChargees.set(url, p);
    p.catch(() => lutsChargees.delete(url));
  }
  return p;
}

function chargerImage(url: string): Promise<HTMLImageElement> {
  let p = imagesChargees.get(url);
  if (!p) {
    p = new Promise((ok, ko) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      // Image décodée d'avance : le dessin de la composition ne paie plus le décodage.
      img.onload = () => img.decode().then(() => ok(img), () => ok(img));
      img.onerror = () => ko(new Error("image"));
      img.src = url;
    });
    p = p.then((img) => {
      imagesPretes.set(url, img);
      return img;
    });
    imagesChargees.set(url, p);
    p.catch(() => imagesChargees.delete(url));
  }
  return p;
}

/**
 * Aperçu rapide (02/10) : charge et décode d'avance la LUT et les images d'un plateau (appelé par l'écran
 * « Votre vidéo » quand le navigateur est libre). Quand la feuille s'ouvre, il ne reste que la composition.
 */
export function prechargerApercuPlateau({ decor, detoureUrl, vignetteUrl, lut }: Pick<ProprietesApercuPlateau, "decor" | "detoureUrl" | "vignetteUrl" | "lut">): void {
  if (typeof window === "undefined") return;
  if (decor?.imageUrl) chargerImage(decor.imageUrl).catch(() => null);
  const sujet = detoureUrl ?? vignetteUrl;
  if (sujet) chargerImage(sujet).catch(() => null);
  if (lut?.url && lut.intensite > 0) chargerLut(lut.url).catch(() => null);
}

function dessinerCouvrant(ctx: CanvasRenderingContext2D, img: HTMLImageElement, l: number, h: number) {
  const r = Math.max(l / img.naturalWidth, h / img.naturalHeight);
  const w = img.naturalWidth * r;
  const hh = img.naturalHeight * r;
  ctx.drawImage(img, (l - w) / 2, (h - hh) / 2, w, hh);
}

/** Décor : image floutée, ou teinte + lueur du côté de la lumière. */
function dessinerDecor(ctx: CanvasRenderingContext2D, decor: DecorPlateau | null, image: HTMLImageElement | null) {
  ctx.save();
  ctx.fillStyle = decor?.teinte ?? "#110A05";
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  if (image) {
    const flou = (decor?.profondeurFlou ?? 0) * ECHELLE_1080;
    if (flou > 0) ctx.filter = `blur(${flou.toFixed(1)}px)`;
    dessinerCouvrant(ctx, image, LARGEUR, HAUTEUR);
    ctx.filter = "none";
  } else if (decor?.teinteLumiere) {
    const cx = decor.directionLumiere === "gauche" ? LARGEUR * 0.2 : decor.directionLumiere === "droite" ? LARGEUR * 0.8 : LARGEUR * 0.5;
    const g = ctx.createRadialGradient(cx, HAUTEUR * 0.36, 10, cx, HAUTEUR * 0.36, LARGEUR * 0.75);
    g.addColorStop(0, `${decor.teinteLumiere}AA`);
    g.addColorStop(1, `${decor.teinteLumiere}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  }
  ctx.restore();
}

/** Le double : détouré, ancré en bas ; sinon la vignette brute aux bords adoucis. */
function dessinerSujet(ctx: CanvasRenderingContext2D, img: HTMLImageElement, detoure: boolean, positionSujet: number) {
  const hauteur = HAUTEUR * (detoure ? 0.8 : 0.62);
  const largeur = (img.naturalWidth / img.naturalHeight) * hauteur;
  const x = LARGEUR * positionSujet - largeur / 2;
  const y = HAUTEUR - hauteur;
  if (detoure) {
    ctx.drawImage(img, x, y, largeur, hauteur);
    return;
  }
  const tampon = document.createElement("canvas");
  tampon.width = Math.ceil(largeur);
  tampon.height = Math.ceil(hauteur);
  const t = tampon.getContext("2d")!;
  t.drawImage(img, 0, 0, largeur, hauteur);
  t.globalCompositeOperation = "destination-in";
  const g = t.createRadialGradient(largeur / 2, hauteur * 0.45, Math.min(largeur, hauteur) * 0.28, largeur / 2, hauteur * 0.5, Math.max(largeur, hauteur) * 0.62);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  t.fillStyle = g;
  t.fillRect(0, 0, largeur, hauteur);
  ctx.drawImage(tampon, x, y);
}

/** Micro de podcast stylisé (silhouette sombre, flou), coupé par le bord de l'image. */
function dessinerMicro(ctx: CanvasRenderingContext2D, m: NonNullable<ProprietesApercuPlateau["micro"]>) {
  const l = (LARGEUR * m.largeurPct) / 100;
  const x = LARGEUR * m.x - l / 2;
  const y = HAUTEUR * m.y;
  ctx.save();
  ctx.filter = `blur(${(m.flouPx * ECHELLE_1080 * 1.5).toFixed(1)}px)`;
  ctx.fillStyle = "#0b0806";
  ctx.beginPath();
  ctx.roundRect(x, y, l, l * 1.5, l / 2);
  ctx.fill();
  ctx.fillStyle = "#2a211b";
  ctx.fillRect(x + l * 0.42, y + l * 1.45, l * 0.16, HAUTEUR);
  ctx.restore();
}

const programmes = new WeakMap<WebGL2RenderingContext, WebGLProgram>();

/** LUT par shader WebGL2 (texture 3D). Renvoie false si WebGL2 manque. */
function appliquerLutWebgl(canvas: HTMLCanvasElement, source: HTMLCanvasElement, lut: Lut3D, intensite: number): boolean {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return false;
  // Programme compilé une fois par contexte (aperçu rapide, 02/10), puis réutilisé à chaque changement de décor.
  let prog = programmes.get(gl) ?? null;
  if (!prog) {
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, SOMMETS_LUT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAGMENTS_LUT));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    programmes.set(gl, prog);
  }
  gl.useProgram(prog);
  const tampon = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  const image = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

  gl.activeTexture(gl.TEXTURE1);
  const t3 = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, t3);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, lut.taille, lut.taille, lut.taille, 0, gl.RGBA, gl.UNSIGNED_BYTE, donneesTexture3D(lut));

  gl.uniform1i(gl.getUniformLocation(prog, "image"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "lut"), 1);
  gl.uniform1f(gl.getUniformLocation(prog, "taille"), lut.taille);
  gl.uniform1f(gl.getUniformLocation(prog, "intensite"), intensite);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
}

export function ApercuPlateau({ decor, detoureUrl, vignetteUrl, micro, lut, className }: ProprietesApercuPlateau) {
  const visible2d = useRef<HTMLCanvasElement>(null);
  const visibleGl = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"2d" | "webgl">("2d");
  const [duree, setDuree] = useState<number | null>(null);
  const [lutAbsente, setLutAbsente] = useState(false);
  const sujetUrl = detoureUrl ?? vignetteUrl ?? null;
  const cle = JSON.stringify([decor, sujetUrl, !!detoureUrl, micro, lut?.url, lut?.intensite]);

  useEffect(() => {
    let annule = false;
    const debut = performance.now();
    const composer = (imgDecor: HTMLImageElement | null, imgSujet: HTMLImageElement | null, lutChargee: Lut3D | null) => {
      const compo = document.createElement("canvas");
      compo.width = LARGEUR;
      compo.height = HAUTEUR;
      const ctx = compo.getContext("2d")!;
      dessinerDecor(ctx, decor, imgDecor);
      if (imgSujet) dessinerSujet(ctx, imgSujet, !!detoureUrl, decor?.positionSujet ?? 0.5);
      if (micro) dessinerMicro(ctx, micro);
      setLutAbsente(!!lut && lut.intensite > 0 && !lutChargee);

      const intensite = (lut?.intensite ?? 0) / 100;
      if (lutChargee && visibleGl.current && appliquerLutWebgl(visibleGl.current, compo, lutChargee, intensite)) {
        setMode("webgl");
      } else {
        const sortie = visible2d.current?.getContext("2d");
        if (sortie) {
          if (lutChargee) {
            const pixels = ctx.getImageData(0, 0, LARGEUR, HAUTEUR);
            appliquerLutPixels(pixels.data, lutChargee, intensite);
            ctx.putImageData(pixels, 0, 0);
          }
          sortie.clearRect(0, 0, LARGEUR, HAUTEUR);
          sortie.drawImage(compo, 0, 0);
        }
        setMode("2d");
      }
      setDuree(Math.round(performance.now() - debut));
    };
    const urlLut = lut?.url && lut.intensite > 0 ? lut.url : null;
    // Tout est déjà chargé (préchargé par l'écran « Votre vidéo », ou composé une fois) : composition immédiate.
    const pret = (!decor?.imageUrl || imagesPretes.has(decor.imageUrl)) && (!sujetUrl || imagesPretes.has(sujetUrl)) && (!urlLut || lutsPretes.has(urlLut));
    if (pret) {
      composer(decor?.imageUrl ? imagesPretes.get(decor.imageUrl)! : null, sujetUrl ? imagesPretes.get(sujetUrl)! : null, urlLut ? lutsPretes.get(urlLut)! : null);
    } else {
      (async () => {
        const [imgDecor, imgSujet, lutChargee] = await Promise.all([
          decor?.imageUrl ? chargerImage(decor.imageUrl).catch(() => null) : Promise.resolve(null),
          sujetUrl ? chargerImage(sujetUrl).catch(() => null) : Promise.resolve(null),
          urlLut ? chargerLut(urlLut).catch(() => null) : Promise.resolve(null),
        ]);
        if (!annule) composer(imgDecor, imgSujet, lutChargee);
      })();
    }
    return () => {
      annule = true;
    };
    // `cle` résume toutes les entrées de la composition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return (
    <figure className={cn("relative isolate mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[20px] border border-trait bg-fond shadow-carte", className)} data-duree-ms={duree ?? undefined} data-testid="apercu-plateau">
      <canvas ref={visible2d} width={LARGEUR} height={HAUTEUR} aria-hidden className={cn("absolute inset-0 size-full", mode !== "2d" && "invisible")} />
      <canvas ref={visibleGl} width={LARGEUR} height={HAUTEUR} aria-hidden className={cn("absolute inset-0 size-full", mode !== "webgl" && "invisible")} />
      <figcaption className="sr-only">Aperçu de votre plateau</figcaption>
      {duree === null && <span aria-hidden className="absolute inset-0 animate-pulse bg-surface-2" />}
      {!sujetUrl && (
        <span className="absolute inset-x-0 bottom-6 grid place-items-center text-texte-faible">
          <Icone nom="visage" size={40} />
        </span>
      )}
      <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
        {sujetUrl && !detoureUrl && <Pastille ton="neutre">Image non détourée</Pastille>}
        {lutAbsente && <Pastille ton="neutre">Couleurs appliquées à la fabrication</Pastille>}
      </span>
    </figure>
  );
}
