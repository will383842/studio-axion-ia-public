/**
 * CALQUES IMAGE DANS FFMPEG (lot M4b ; plan B.7, calques 1 à 6) — PUR (écrit les arguments, testé).
 *
 * Mesure du lot M4 : 60 % du temps d'une vidéo passait à faire dessiner les calques image par le navigateur
 * (≈ 3 images/s), puis à réencoder cette vidéo pour la LUT. Ici, UNE seule passe FFmpeg fait tout, sur des fichiers
 * déjà prêts une fois pour toutes (décor redimensionné et flouté, accessoire dessiné et flouté) :
 *
 *   décor (image fixe) ← liseré de contour ← double (webm transparent, piste continue) ← accessoire (PNG)
 *   → recadrage du plan (9:16 : fenêtre agrandie au Lanczos, zoom lent par `zoompan` ; 4:5 et 1:1 : double réduit,
 *     ancré en bas) → illustrations plein écran (coupe franche) → LUT, vignette, grain en luminance → master.
 *
 * Chaque plan est un MORCEAU d'images [début, fin) découpé dans les pistes continues (`trim` par numéro d'image :
 * les lèvres ne sont jamais décalées), puis les morceaux sont mis bout à bout (`concat`). La géométrie vient de
 * `scene.ts` (la même que le montage tout navigateur, qui reste le repli pour le double simulé « silhouette »).
 */
import { cadreSource, DIMENSIONS_SCENE, SOURCE_DOUBLE, transformation, type CameraScene, type ParametresCouleurs, type PlanScene, type ProprietesImageComposition, type SourceDouble } from "../../../src/briques/composition/scene.js";
import { chaineCouleurs, sourceGrain } from "./ffmpeg.js";

/** Une source du double prête pour FFmpeg : un fichier local (webm transparent ou image détourée). */
export interface FichierDouble {
  fichier: string;
  video: boolean;
  /** Lot R7d : passages (second angle), chacun posé à `debutSec` sur la ligne de temps. Absent : piste continue. */
  tranches?: { fichier: string; debutSec: number; finSec: number }[];
}

/** Lot R7d : le passage d'où viennent les images [debut, fin) d'un morceau (celui qui le contient, sinon le plus proche). */
export function trancheDuMorceau(tranches: { debutSec: number; finSec: number }[], m: Pick<Morceau, "debut" | "fin">, fps: number): number {
  let meilleur = 0;
  let recouvrement = -Infinity;
  tranches.forEach((t, i) => {
    const a = Math.round(t.debutSec * fps);
    const b = Math.round(t.finSec * fps);
    const r = Math.min(b, m.fin) - Math.max(a, m.debut);
    if (r > recouvrement) {
      recouvrement = r;
      meilleur = i;
    }
  });
  return meilleur;
}

/** Fichiers locaux du montage FFmpeg (chemins relatifs au dossier de travail). */
export interface FichiersImage {
  /** Décor PRÊT : à la taille du canevas (`tailleCanevas`), recadré et flouté une fois. Absent : la teinte seule. */
  decor?: string;
  doubles: { principal: FichierDouble; second?: FichierDouble };
  /** Accessoire PRÊT (PNG transparent, flou compris) et son coin dans le cadre source (`tailleAccessoire`). */
  accessoire?: { fichier: string; x: number; y: number; largeur: number; hauteur: number };
  /** Illustration de chaque plan (index dans `plans`). */
  illustrations: Record<number, { fichier: string; video: boolean }>;
  /** LUT déjà mélangées à leur intensité, avec leurs plages de temps. */
  luts: { fichier: string; plages: [number, number][] }[];
  /** Son final (voix + ton de pièce), mis en double mono dans le master. */
  son: string;
  /** Facecam lot C (ajout pur) : cartes des écrans partagés, nom d'entrée → fichier local. */
  cartes?: Record<string, string>;
  /** Mission H, multicaméra (ajout pur) : vidéo de chaque angle fabriqué (même son que la piste principale). */
  cameras?: Partial<Record<CameraScene, FichierDouble>>;
}

/** Source d'un morceau : la piste principale, le second angle (avocat), ou un angle de la multicaméra. */
type SourceMorceau = "principal" | "second" | CameraScene;
const ETIQUETTES_SOURCE: Record<SourceMorceau, string> = { principal: "dp", second: "ds", cote: "dc", "contre-plongee": "dk" };

/** Le montage FFmpeg sait-il dessiner ces calques ? Non pour le double SIMULÉ (silhouette dessinée) : navigateur. */
export function imageParFfmpeg(p: Pick<ProprietesImageComposition, "doubles" | "cameras">): boolean {
  const ok = (s?: SourceDouble) => !s || s.type === "video" || s.type === "image" || s.type === "tranches";
  return ok(p.doubles.principal) && ok(p.doubles.second) && ok(p.cameras?.cote) && ok(p.cameras?.["contre-plongee"]);
}

/** Canevas où se posent décor et double : le cadre source en 9:16 (recadré ensuite), l'image entière sinon. */
export function tailleCanevas(p: Pick<ProprietesImageComposition, "ratio" | "sourcePreCadree">): { largeur: number; hauteur: number } {
  if (p.sourcePreCadree) return { ...DIMENSIONS_SCENE[p.ratio] };
  return p.ratio === "9:16" ? { ...SOURCE_DOUBLE } : DIMENSIONS_SCENE[p.ratio];
}

export interface Morceau {
  /** Index du plan dans `plans` (−1 : aucun plan, le double en plan large). */
  index: number;
  plan: PlanScene;
  /** Images [debut, fin) de la vidéo. */
  debut: number;
  fin: number;
}

const PLAN_LARGE: PlanScene = { debutSec: 0, finSec: 1e9, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } };

/**
 * Découpe en morceaux d'images, comme `planAuTemps` : l'image i appartient au plan dont début ≤ i / fps < fin.
 * Le premier morceau part de 0, le dernier va jusqu'à `images` ; un plan plus court qu'une image disparaît.
 */
export function morceaux(plans: PlanScene[], images: number, fps: number): Morceau[] {
  if (!plans.length) return [{ index: -1, plan: PLAN_LARGE, debut: 0, fin: images }];
  const debuts = plans.map((p, i) => (i === 0 ? 0 : Math.min(images, Math.max(0, Math.ceil(p.debutSec * fps - 1e-4)))));
  const liste: Morceau[] = [];
  for (let i = 0; i < plans.length; i++) {
    const debut = debuts[i];
    const fin = i + 1 < plans.length ? debuts[i + 1] : images;
    if (fin > debut) liste.push({ index: i, plan: plans[i], debut, fin });
  }
  return liste;
}

const hex = (c: string) => `0x${c.replace(/^#/, "").slice(0, 6).toUpperCase()}`;
const rvb = (c: string) => {
  const h = c.replace(/^#/, "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
};
const f3 = (x: number) => (Math.round(x * 1e6) / 1e6).toString();

/**
 * Recadrage 9:16 d'un morceau (le composé décor + double + accessoire, à la taille du cadre source) : fenêtre
 * agrandie au Lanczos (zoom constant), ou `zoompan` pour le zoom lent (100 → 106 %), autour du point d'intérêt,
 * jamais un bord découvert. Vide si le plan est à 100 %.
 */
export function filtreRecadrage916(plan: PlanScene, m: Pick<Morceau, "debut" | "fin">, fps: number, ratio: ProprietesImageComposition["ratio"] = "9:16"): string {
  // Facecam (source pré-cadrée) : la même fenêtre agrandie dans le cadre du ratio (9:16 par défaut, comme avant).
  const { largeur: W, hauteur: H } = DIMENSIONS_SCENE[ratio];
  const z0 = Math.max(1, plan.cadrage.zoom);
  const z1 = Math.max(1, plan.cadrage.zoomFin);
  if (Math.abs(z1 - z0) < 1e-6) {
    if (z0 <= 1 + 1e-6) return "";
    // Même fenêtre que `transformation` (scene.ts), arrondie au pixel.
    const tr = transformation(ratio, { ...plan, cadrage: { ...plan.cadrage, zoomFin: plan.cadrage.zoom } }, plan.debutSec, undefined, ratio !== "9:16");
    const l = Math.round(W / tr.conteneur.echelle);
    const h = Math.round(H / tr.conteneur.echelle);
    const x = Math.round(Math.min(W - l, Math.max(0, -tr.conteneur.x / tr.conteneur.echelle)));
    const y = Math.round(Math.min(H - h, Math.max(0, -tr.conteneur.y / tr.conteneur.echelle)));
    return `crop=${l}:${h}:${x}:${y},scale=${W}:${H}:flags=lanczos`;
  }
  return zoompan(plan, m, fps, W, H, `clip(${f3(plan.cadrage.pointX)}*iw-iw/zoom/2\\,0\\,iw-iw/zoom)`, `clip(${f3(plan.cadrage.pointY)}*ih-ih/zoom/2\\,0\\,ih-ih/zoom)`, z0, z1);
}

/** Zoom lent (k de 0 à 1 sur la durée du plan, comme `zoomAuTemps`), une image de sortie par image d'entrée. */
function zoompan(plan: PlanScene, m: Pick<Morceau, "debut">, fps: number, W: number, H: number, x: string, y: string, z0: number, z1: number): string {
  const d = Math.max(1e-6, plan.finSec - plan.debutSec);
  const k = `clip(((${m.debut}+on)/${fps}-${f3(plan.debutSec)})/${f3(d)}\\,0\\,1)`;
  return `zoompan=z='${f3(z0)}+${f3(z1 - z0)}*${k}':x='${x}':y='${y}':d=1:s=${W}x${H}:fps=${fps}`;
}

/** Nom d'entrée d'une référence `entree:<nom>` (carte d'un écran partagé). */
const nomEntreeEcran = (ref: string): string | null => (ref.startsWith("entree:") ? ref.slice("entree:".length) : null);

/**
 * Facecam lot G : graphe d'une mise en page sur le plan `k` (`[p${k}]` : l'image composée de Will → `[m${k}]`).
 *   - côté : fond de la charte, la colonne de Will glisse de sa place dans l'image pleine vers son côté, la carte entre
 *     par l'autre bord (courbe unique, sortie expo, `entreeImages` images), puis immobile ;
 *   - vignette : la carte plein écran entre par le bas ; Will, recadré serré (jamais agrandi), dans un coin en haut.
 * `ouvrirCarte` ajoute l'entrée du fichier de la carte (décalée de `carteDebutSec`) et rend son index.
 */
export function filtresMiseEnPage(mp: NonNullable<ProprietesImageComposition["plans"][number]["miseEnPage"]>, k: number, d: { W: number; H: number; fps: number; nb: number; formats?: FormatsPixels }, ouvrirCarte: (nom: string) => number): string[] {
  const { W, H, fps, nb } = d;
  const { rvb: fRvb, ov: fOv } = d.formats ?? FORMATS_8_BITS;
  const nom = nomEntreeEcran(mp.carte);
  if (!nom) throw new Error("Carte de la mise en page absente de la demande.");
  const iCarte = ouvrirCarte(nom);
  const e = mp.entreeImages > 0 ? `(1-pow(2\\,-10*min(1\\,n/${mp.entreeImages})))/(1-pow(2\\,-10))` : "1";
  const tenir = `tpad=stop_mode=clone:stop_duration=${((nb + 2) / fps).toFixed(3)},trim=end_frame=${nb},setpts=PTS-STARTPTS`;
  const l: string[] = [`color=c=0x16120F:s=${W}x${H}:r=${fps},format=${fRvb},trim=end_frame=${nb},setpts=PTS-STARTPTS[z${k}]`];
  if (mp.mode === "cote" && mp.geometrie.cote) {
    const g = mp.geometrie.cote;
    l.push(`[p${k}]crop=${g.largeurPersonne}:${H}:${g.sourceX}:0[pc${k}]`);
    l.push(`[z${k}][pc${k}]overlay=x='${g.sourceX}+(${g.xPersonne - g.sourceX})*${e}':y=0:eval=frame:format=${fOv}[y${k}]`);
    l.push(`[${iCarte}:v]fps=${fps},scale=${g.largeurCarte}:${H}:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=${fRvb},setsar=1,${tenir}[q${k}]`);
    const depart = g.xCarte === 0 ? -g.largeurCarte : W;
    l.push(`[y${k}][q${k}]overlay=x='${depart}+(${g.xCarte - depart})*${e}':y=0:eval=frame:format=${fOv},format=${fRvb},setsar=1[m${k}]`);
    return l;
  }
  const v = mp.geometrie.vignette;
  if (!v) throw new Error("Géométrie de la mise en page absente.");
  l.push(`[${iCarte}:v]fps=${fps},scale=${W}:${H}:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=${fRvb},setsar=1,${tenir}[q${k}]`);
  l.push(`[z${k}][q${k}]overlay=x=0:y='${H}-${H}*${e}':eval=frame:format=${fOv}[y${k}]`);
  const r = v.recadrage;
  l.push(`[p${k}]crop=${r.largeur}:${r.hauteur}:${r.x}:${r.y},scale=${v.place.largeur}:${v.place.hauteur}:flags=lanczos,format=${fRvb},setsar=1[pv${k}]`);
  l.push(`[y${k}][pv${k}]overlay=x=${v.place.x}:y=${v.place.y}:format=${fOv},format=${fRvb},setsar=1[m${k}]`);
  return l;
}

/** Formats de pixels du graphe : RVB (calques), RVB avec alpha, et format des superpositions (`overlay`). */
export interface FormatsPixels {
  rvb: string;
  rvba: string;
  ov: string;
}
export const FORMATS_8_BITS: FormatsPixels = { rvb: "gbrp", rvba: "gbrap", ov: "gbrp" };
/** `overlay` n'a pas de RVB 10 bits : il travaille en YUV 4:4:4 10 bits (aucune perte de chroma, aucune descente). */
export const FORMATS_10_BITS: FormatsPixels = { rvb: "gbrp10le", rvba: "gbrap10le", ov: "yuv444p10" };

/** Décodeur d'une vidéo du double : vp9 imposé pour un webm (garde la transparence), celui par défaut sinon (mp4). */
const decodeurDouble = (fichier: string): string[] => (fichier.toLowerCase().endsWith(".webm") ? ["-c:v", "libvpx-vp9"] : []);

/**
 * Arguments de la passe unique « calques image + couleurs → master sans texte » (entrées, graphe, sorties).
 * `dureeSec` : durée de la vidéo ; le master porte le son en PCM double mono (le recalque ne perd rien).
 */
/** Correcteur réel 2 : fondu de fin (au noir, et son) terminé à la fin de la vidéo. PUR, testé. */
export function filtresFonduFin(dureeSec: number, fonduSec: number): { video: string; audio: string } {
  const d = Math.max(0, Math.min(fonduSec, dureeSec));
  const st = Math.max(0, dureeSec - d);
  return { video: `fade=t=out:st=${st.toFixed(3)}:d=${d.toFixed(3)}:color=black`, audio: `afade=t=out:st=${st.toFixed(3)}:d=${d.toFixed(3)}` };
}

export function argumentsImageFfmpeg(
  p: ProprietesImageComposition,
  couleurs: Pick<ParametresCouleurs, "grainPct" | "grainTaillePx" | "vignettePct">,
  f: FichiersImage,
  dureeSec: number,
  sortie: string,
  options: { preset?: string; /** Fils de FFmpeg (filtres et encodeur) : les cœurs DU CONTENEUR, pas ceux de la machine. */ fils?: number } = {},
): string[] {
  const fps = p.fps;
  // V6 P0 n° 1 : source 10 bits → composition en RVB 10 bits (`gbrp10le`), superpositions en YUV 4:4:4 10 bits,
  // couleurs et grain en 10 bits ; une seule descente en 8 bits, à l'export (tramage). Sinon : le graphe d'avant.
  const formats = p.source10bits ? FORMATS_10_BITS : FORMATS_8_BITS;
  const { rvb: fRvb, rvba: fRvba, ov: fOv } = formats;
  const { largeur: W, hauteur: H } = DIMENSIONS_SCENE[p.ratio];
  const canevas = tailleCanevas(p);
  // Cadre de la source du double : 1080 × 1920, ou la taille du ratio en mode pré-cadré (facecam, absent : inchangé).
  const cadre = cadreSource(p);
  const pleinCadre = p.ratio === "9:16" || !!p.sourcePreCadree;
  const duree = (dureeSec + 2 / fps).toFixed(3);
  const entrees: string[] = [];
  let n = 0;
  const entree = (...args: string[]) => {
    entrees.push(...args);
    return n++;
  };
  // Image fixe : lue UNE fois, répétée DANS le graphe (`loop`), donc tirée à la demande. En entrée « -loop 1 », elle
  // était poussée aussi vite que possible et s'empilait devant les morceaux à venir (2,3 Go mesurés sur 15 s).
  // Vérif A2 (10/10) : base de temps posée à 1/fps AVANT `setpts=N` (entier exact). Avec `setpts=N/fps/TB`, FFmpeg
  // tronquait (N = 57 → 56,99 → 56) : deux images au même instant, la suivante sautée (249 images sur 250, saccade).
  const fixe = (fichier: string, nombre = p.images + 2) => `[${entree("-i", fichier)}:v]loop=loop=-1:size=1,settb=1/${fps},setpts=N,trim=end_frame=${nombre},`;
  const lignes: string[] = [];
  const liste = morceaux(p.plans, p.images, fps);
  const estIllustration = (m: Morceau) => m.plan.type === "illustration" && !!f.illustrations[m.index];
  const morceauxDouble = liste.filter((m) => !estIllustration(m));
  // Mission H : un morceau qui porte `camera` lit l'angle fabriqué (s'il a son fichier), sinon la piste d'avant.
  const angleDe = (m: Morceau): SourceMorceau => (m.plan.camera && f.cameras?.[m.plan.camera] ? m.plan.camera : m.plan.angle === "second" && f.doubles.second ? "second" : "principal");
  const fichierDe = (a: SourceMorceau): FichierDouble | undefined => (a === "principal" || a === "second" ? f.doubles[a] : f.cameras?.[a]);

  // --- Entrées continues, partagées par les morceaux (une `split` par piste) ---
  const decoupe = (source: string, nom: string, nombre: number) => {
    if (nombre === 1) lignes.push(`${source}null[${nom}0]`);
    else if (nombre > 1) lignes.push(`${source}split=${nombre}${Array.from({ length: nombre }, (_, i) => `[${nom}${i}]`).join("")}`);
  };
  if (morceauxDouble.length) {
    // Sans image : la teinte, source DU graphe (tirée à la demande, elle aussi).
    const sourceDecor = f.decor ? fixe(f.decor) : `color=c=${hex(p.decor.teinte)}:s=${canevas.largeur}x${canevas.hauteur}:r=${fps}:d=${duree},`;
    decoupe(`${sourceDecor}format=${fRvb},setsar=1,`, "dec", morceauxDouble.length);
    for (const angle of ["principal", "second", "cote", "contre-plongee"] as const) {
      const src = fichierDe(angle);
      const nombre = morceauxDouble.filter((m) => angleDe(m) === angle).length;
      if (!src || !nombre) continue;
      // Lot R7d : passages du second angle — une entrée par passage, découpée pour SES morceaux seulement.
      if (src.tranches?.length) {
        src.tranches.forEach((t, ti) => {
          const n = morceauxDouble.filter((m) => angleDe(m) === angle && trancheDuMorceau(src.tranches!, m, fps) === ti).length;
          if (!n) return;
          // Lot R7e : fond uni = passages mp4 (H.264) ; le décodeur vp9 (transparence) seulement pour un webm.
          const source = `[${entree(...decodeurDouble(t.fichier), "-i", t.fichier)}:v]`;
          const prep = `${source}fps=${fps},scale=${cadre.largeur}:${cadre.hauteur}:force_original_aspect_ratio=decrease:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=${fRvba},pad=${cadre.largeur}:${cadre.hauteur}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,tpad=stop_mode=clone:stop_duration=${duree},`;
          decoupe(prep, `ds${ti}_`, n);
        });
        continue;
      }
      const source = src.video ? `[${entree(...decodeurDouble(src.fichier), "-i", src.fichier)}:v]` : fixe(src.fichier);
      // `contain` dans le cadre source 1080 × 1920 ; une vidéo sans étiquette est lue en BT.709 (comme le navigateur).
      const matrice = src.video ? ":in_color_matrix=bt709:in_range=tv" : "";
      const prep = `${source}fps=${fps},scale=${cadre.largeur}:${cadre.hauteur}:force_original_aspect_ratio=decrease:flags=lanczos${matrice},format=${fRvba},pad=${cadre.largeur}:${cadre.hauteur}:(ow-iw)/2:(oh-ih)/2:color=black@0,setsar=1,tpad=stop_mode=clone:stop_duration=${duree},`;
      decoupe(prep, ETIQUETTES_SOURCE[angle], nombre);
    }
    if (f.accessoire) decoupe(`${fixe(f.accessoire.fichier)}format=${fRvba},setsar=1,`, "acc", morceauxDouble.length);
  }

  // --- Un morceau par plan ---
  const compteurs: Record<SourceMorceau, number> = { principal: 0, second: 0, cote: 0, "contre-plongee": 0 };
  const compteursTranches: Record<number, number> = {};
  const sorties: string[] = [];
  let kd = 0;
  for (const [k, m] of liste.entries()) {
    const nb = m.fin - m.debut;
    const trim = `trim=start_frame=${m.debut}:end_frame=${m.fin},setpts=PTS-STARTPTS`;
    if (estIllustration(m)) {
      const ill = f.illustrations[m.index];
      const source = ill.video ? `[${entree("-i", ill.fichier)}:v]fps=${fps},` : fixe(ill.fichier, nb + 2);
      const matrice = ill.video ? ":in_color_matrix=bt709:in_range=tv" : "";
      // Plein écran, « cover », sur fond noir (une image transparente est posée sur le noir), coupe franche.
      // 10/10 (« zoom demandé = image cassée ») : posée par `overlay` sur un fond noir, plus par `premultiply`. Depuis
      // FFmpeg 8, le mode d'alpha est négocié sur tout le graphe relié par `concat` : le « prémultiplié » de cette
      // carte passait aux `overlay` 10 bits des plans filmés, dont toute la chrominance partait (fond jaune, peau magenta).
      lignes.push(`color=c=black:s=${W}x${H}:r=${fps},format=${fRvb},trim=end_frame=${nb},setpts=PTS-STARTPTS[n${k}]`);
      lignes.push(`${source}scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos${matrice},crop=${W}:${H},format=${fRvba},setsar=1,tpad=stop_mode=clone:stop_duration=${((nb + 2) / fps).toFixed(3)},trim=end_frame=${nb},setpts=PTS-STARTPTS[i${k}]`);
      lignes.push(`[n${k}][i${k}]overlay=x=0:y=0:format=${fOv},format=${fRvb},setsar=1[m${k}]`);
      sorties.push(`[m${k}]`);
      continue;
    }
    const angle = angleDe(m);
    // Lot R7d : un morceau du second angle rendu par passages lit SON passage, décalé du début du passage.
    const tranches = fichierDe(angle)?.tranches;
    const ti = tranches?.length ? trancheDuMorceau(tranches, m, fps) : -1;
    const d = ti >= 0 ? `ds${ti}_${(compteursTranches[ti] = (compteursTranches[ti] ?? -1) + 1)}` : `${ETIQUETTES_SOURCE[angle]}${compteurs[angle]++}`;
    const decalage = ti >= 0 ? Math.round(tranches![ti].debutSec * fps) : 0;
    const trimDouble = decalage ? `trim=start_frame=${Math.max(0, m.debut - decalage)}:end_frame=${Math.max(1, m.fin - decalage)},setpts=PTS-STARTPTS` : trim;
    // Boîte du double dans le canevas : plein cadre en 9:16 ; réduite et ancrée en bas en 4:5 / 1:1 (début du plan).
    const tr = transformation(p.ratio, { ...m.plan, cadrage: { ...m.plan.cadrage, zoomFin: m.plan.cadrage.zoom } }, m.plan.debutSec, p.reductionLarge, !!p.sourcePreCadree);
    const boite = { x: Math.round(tr.double.gauche), y: Math.round(tr.double.haut), l: Math.round(tr.double.largeur), h: Math.round(tr.double.hauteur) };
    const echelle = boite.h / cadre.hauteur;
    const redim = pleinCadre ? "" : `,scale=${boite.l}:${boite.h}:flags=lanczos`;
    lignes.push(`[dec${kd}]${trim}[b${k}]`);
    let fond = `b${k}`;
    if (p.contour) {
      // Liseré de lumière de contour (B.3) : la silhouette du double, teinte unie, décalée de 2 px du côté opposé à la lumière.
      const [r, g, b] = rvb(p.contour.couleur);
      const dx = (p.contour.cote === "droite" ? 2 : -2) * (W / 1080);
      lignes.push(`[${d}]${trimDouble}${redim},split[d${k}][l${k}]`);
      // En 10 bits, `lutrgb` lit des valeurs de 0 à 1023.
      const q = p.source10bits ? 4 : 1;
      lignes.push(`[l${k}]lutrgb=r=${r * q}:g=${g * q}:b=${b * q}[h${k}]`);
      lignes.push(`[${fond}][h${k}]overlay=x=${boite.x + Math.round(dx)}:y=${boite.y}:format=${fOv}[c${k}]`);
      fond = `c${k}`;
    } else lignes.push(`[${d}]${trimDouble}${redim}[d${k}]`);
    lignes.push(`[${fond}][d${k}]overlay=x=${boite.x}:y=${boite.y}:format=${fOv}[e${k}]`);
    fond = `e${k}`;
    if (f.accessoire) {
      const a = f.accessoire;
      const ra = pleinCadre ? "" : `,scale=${Math.max(2, Math.round(a.largeur * echelle))}:${Math.max(2, Math.round(a.hauteur * echelle))}:flags=lanczos`;
      lignes.push(`[acc${kd}]${trim}${ra}[a${k}]`);
      lignes.push(`[${fond}][a${k}]overlay=x=${boite.x + Math.round(a.x * echelle)}:y=${boite.y + Math.round(a.y * echelle)}:format=${fOv}[f${k}]`);
      fond = `f${k}`;
    }
    // Recadrage du plan.
    let recadrage = "";
    if (pleinCadre) recadrage = filtreRecadrage916(m.plan, m, fps, p.ratio);
    else if (Math.abs(m.plan.cadrage.zoomFin - m.plan.cadrage.zoom) > 1e-6) {
      // Zoom lent hors 9:16 : tout le composé grandit, ancré en bas au centre (le décor, flou, bouge à peine).
      recadrage = zoompan(m.plan, m, fps, W, H, "(iw-iw/zoom)/2", "ih-ih/zoom", 1, m.plan.cadrage.zoomFin / Math.max(1e-6, m.plan.cadrage.zoom));
    }
    const ep = m.plan.ecranPartage;
    const mp = m.plan.miseEnPage;
    lignes.push(`[${fond}]${recadrage ? `${recadrage},` : ""}format=${fRvb},setsar=1[${ep || mp ? `p${k}` : `m${k}`}]`);
    if (mp && !ep) lignes.push(...filtresMiseEnPage(mp, k, { W, H, fps, nb, formats }, (nom) => {
      const fichier = f.cartes?.[nom];
      if (!fichier) throw new Error("Carte de la mise en page absente de la demande.");
      return entree("-ss", mp.carteDebutSec.toFixed(3), "-i", fichier);
    }));
    if (ep) {
      // Facecam lot C : écran partagé par passages. Fond de la charte, image de la personne décalée vers le bas, carte
      // en haut ; entrée en `entreeImages` images (sortie expo, même courbe que `entreeEcranPartage`), puis immobile.
      const nomCarte = nomEntreeEcran(ep.carte);
      const fichierCarte = nomCarte ? f.cartes?.[nomCarte] : undefined;
      if (!fichierCarte) throw new Error("Carte de l'écran partagé absente de la demande.");
      const e = ep.entreeImages > 0 ? `(1-pow(2\\,-10*min(1\\,n/${ep.entreeImages})))/(1-pow(2\\,-10))` : "1";
      // Facecam F1 (ajout pur) : côte à côte (16:9), carte à gauche, la personne glisse vers la droite.
      const cote = ep.cote === "gauche" && !!ep.largeurCarte;
      const L = ep.largeurCarte ?? 0;
      const decalage = cote ? L - (ep.sourceX ?? 0) : ep.hauteurHaut - ep.sourceY;
      lignes.push(`color=c=0x16120F:s=${W}x${H}:r=${fps},format=${fRvb},trim=end_frame=${nb},setpts=PTS-STARTPTS[z${k}]`);
      lignes.push(cote ? `[z${k}][p${k}]overlay=x='${decalage}*${e}':y=0:eval=frame:format=${fOv}[y${k}]` : `[z${k}][p${k}]overlay=x=0:y='${decalage}*${e}':eval=frame:format=${fOv}[y${k}]`);
      const iCarte = entree("-ss", ep.carteDebutSec.toFixed(3), "-i", fichierCarte);
      lignes.push(`[${iCarte}:v]fps=${fps},scale=${cote ? `${L}:${H}` : `${W}:${ep.hauteurHaut}`}:flags=lanczos:in_color_matrix=bt709:in_range=tv,format=${fRvb},setsar=1,tpad=stop_mode=clone:stop_duration=${((nb + 2) / fps).toFixed(3)},trim=end_frame=${nb},setpts=PTS-STARTPTS[q${k}]`);
      lignes.push(cote ? `[y${k}][q${k}]overlay=x='${-L}+${L}*${e}':y=0:eval=frame:format=${fOv},format=${fRvb},setsar=1[m${k}]` : `[y${k}][q${k}]overlay=x=0:y='${-ep.hauteurHaut}+${ep.hauteurHaut}*${e}':eval=frame:format=${fOv},format=${fRvb},setsar=1[m${k}]`);
    }
    sorties.push(`[m${k}]`);
    kd++;
  }
  lignes.push(`${sorties.join("")}concat=n=${sorties.length}:v=1:a=0,format=${fRvb}[img]`);

  // --- Couleurs (calque 6) puis son ---
  // Grain : source DU graphe (tirée à la demande) ; en entrée « lavfi », elle courait devant et s'empilait (≈ 1 Go).
  const chaine = chaineCouleurs(couleurs, f.luts, { largeur: W, hauteur: H }, { entree: "[img]", grain: `${sourceGrain({ largeur: W, hauteur: H }, couleurs.grainTaillePx, fps, dureeSec + 2 / fps)},`, dejaRvb: true, dixBits: !!p.source10bits });
  // Correcteur réel 2 : vraie fin, l'image s'éteint au noir et le son en fondu (absent : fin franche, comme avant).
  const fondu = p.fonduFinSec && p.fonduFinSec > 0 ? filtresFonduFin(dureeSec, p.fonduFinSec) : null;
  lignes.push(fondu ? chaine.replace(/\[v\]$/, `[vfin];[vfin]${fondu.video}[v]`) : chaine);
  const iSon = entree("-i", f.son);
  const fils = options.fils && options.fils > 0 ? String(Math.floor(options.fils)) : null;
  return [
    "-hide_banner", "-y",
    // 09/10 : `-filter_complex_threads` (`-filter_threads` ne vise que les graphes simples : il était sans effet ici).
    ...(fils ? ["-filter_complex_threads", fils] : []),
    ...entrees,
    "-filter_complex", lignes.join(";\n"),
    "-map", "[v]", "-map", `${iSon}:a:0`,
    // `ultrafast` : 3 fois moins de temps processeur que `veryfast` (mesuré), fichier intermédiaire plus gros (CRF 12).
    // Facecam (B.8) : source 10 bits → master 10 bits quasi sans perte (aucune compression 8 bits avant l'export).
    ...(p.source10bits
      ? ["-c:v", "libx264", "-preset", options.preset ?? "ultrafast", "-crf", "8", "-pix_fmt", "yuv420p10le", "-profile:v", "high10"]
      : ["-c:v", "libx264", "-preset", options.preset ?? "ultrafast", "-crf", "12", "-pix_fmt", "yuv420p"]),
    ...(fils ? ["-threads", fils] : []),
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
    "-af", `${fondu ? `${fondu.audio},` : ""}pan=stereo|c0=0.7071*c0|c1=0.7071*c0`,
    // Ni `-shortest` ni `-frames:v` : ils arrêtaient le fichier avant la fin du son, et l'export (qui s'arrête au plus
    // court) perdait la dernière image. La vidéo a exactement `images` images (morceaux bornés), le son va à sa fin.
    "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2",
    sortie,
  ];
}
