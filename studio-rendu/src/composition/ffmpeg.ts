/**
 * FFmpeg du montage avocat (lot M4 ; plan B.7). Fonctions PURES qui écrivent les graphes de filtres et les arguments
 * (testées), et lecture des mesures du fichier exporté.
 *
 *  1. COULEURS (calque 6) → piste `master-sans-texte` : passage en RVB BT.709 (plage limitée), LUT 3D en
 *     interpolation tétraédrique sur ses plages de temps (une table déjà mélangée à l'intensité), retour en YUV
 *     BT.709, légère vignette, grain en LUMINANCE seulement (bruit à mi-résolution agrandi : ≈ 2 px, que la
 *     recompression n'efface pas ; il sert aussi de tramage contre les marches de couleur du H.264 8 bits).
 *  2. EXPORT : calques texte (PNG transparents) posés en RVB sur le master, puis H.264 High 4.1, VBR 2 passes
 *     12-16 Mb/s, GOP fermé, `+faststart`, `yuv420p` étiqueté BT.709 / plage tv, AAC-LC 320 kb/s 48 kHz stéréo
 *     (voix mono centrée = double mono).
 */
import type { ParametresCouleurs, ParametresExport } from "../../../src/briques/composition/scene.js";

/** Expression de temps FFmpeg « dans l'une des plages [a, b) ». */
export function expressionPlages(plages: [number, number][]): string {
  return plages.map(([a, b]) => `gte(t\\,${a.toFixed(3)})*lt(t\\,${b.toFixed(3)})`).join("+") || "0";
}

/** Angle de la vignette pour un assombrissement des coins de `pct` % (atténuation en cos⁴). */
export function angleVignette(pct: number): number {
  const k = Math.min(0.6, Math.max(0, pct / 100));
  return +Math.acos(Math.pow(1 - k, 0.25)).toFixed(4);
}

/** Force du bruit (0-100, uniforme) pour un grain de `pct` % en luminance. */
export function forceGrain(pct: number): number {
  return Math.round(Math.min(30, Math.max(0, pct * 2.55)));
}

/**
 * Graphe des COULEURS. Entrées : `[0:v]` l'image composée (calques 1-5), `[1:v]` un fond gris neutre à
 * mi-résolution (source du grain). `luts` : fichiers déjà mélangés à l'intensité, relatifs au dossier de travail.
 */
export function grapheCouleurs(c: Pick<ParametresCouleurs, "grainPct" | "grainTaillePx" | "vignettePct">, luts: { fichier: string; plages: [number, number][] }[], taille: { largeur: number; hauteur: number }): string {
  return chaineCouleurs(c, luts, taille, { entree: "[0:v]", grain: "[1:v]", dejaRvb: false });
}

/**
 * Chaîne des couleurs depuis une étiquette quelconque (lot M4b : à la suite des calques image composés DANS FFmpeg,
 * `dejaRvb` = l'image arrive déjà en RVB, sans aller-retour YUV). Sortie : `[v]`.
 */
export function chaineCouleurs(c: Pick<ParametresCouleurs, "grainPct" | "grainTaillePx" | "vignettePct">, luts: { fichier: string; plages: [number, number][] }[], taille: { largeur: number; hauteur: number }, o: { entree: string; grain: string; dejaRvb: boolean; dixBits?: boolean }): string {
  // V6 P0 n° 1 : en 10 bits (source face caméra), LUT, vignette et grain restent en 10 bits (avant : `yuv420p` 8 bits
  // AVANT le master, d'où des bandes sur les murs en dégradé). Sans `dixBits` : la chaîne d'avant, à l'identique.
  const rvb = o.dixBits ? "gbrp10le" : "gbrp";
  const yuv = o.dixBits ? "yuv420p10le" : "yuv420p";
  const etapes = o.dejaRvb ? [`${o.entree}format=${rvb}`] : [`${o.entree}format=${yuv}`, "scale=in_color_matrix=bt709:in_range=tv", `format=${rvb}`];
  for (const l of luts) if (l.plages.length) etapes.push(`lut3d=file=${l.fichier}:interp=tetrahedral:enable='${expressionPlages(l.plages)}'`);
  etapes.push("scale=out_color_matrix=bt709:out_range=tv", `format=${yuv}`);
  if (c.vignettePct > 0) etapes.push(`vignette=angle=${angleVignette(c.vignettePct)}:eval=init`);
  const image = etapes.join(",") + "[img_c]";
  const force = forceGrain(c.grainPct);
  if (!force) return `${image};[img_c]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]`;
  const grain = `${o.grain}format=yuv420p,noise=c0s=${force}:c0f=t+u,scale=${taille.largeur}:${taille.hauteur}:flags=bicubic,format=${yuv}[grain]`;
  // Mélange « incrustation » sur la luminance seulement : le gris neutre (128) ne change rien ; la chrominance reste.
  const melange = "[img_c][grain]blend=c0_mode=overlay:c1_expr=A:c2_expr=A:shortest=1,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]";
  return `${image};${grain};${melange}`;
}

/** Source du grain : gris neutre à mi-résolution (taille du grain ≈ 2 px à 1080). */
export function sourceGrain(taille: { largeur: number; hauteur: number }, grainTaillePx: number, fps: number, dureeSec: number): string {
  const k = Math.max(1, grainTaillePx);
  const l = Math.round(taille.largeur / k / 2) * 2;
  const h = Math.round(taille.hauteur / k / 2) * 2;
  return `color=c=0x808080:s=${l}x${h}:r=${fps}:d=${dureeSec.toFixed(3)}`;
}

/** Arguments du master sans texte (qualité haute, son PCM stéréo : le recalque ne perd rien). */
export function argumentsMaster(entreeImage: string, entreeSon: string, graphe: string, grain: string, sortie: string): string[] {
  return [
    "-hide_banner", "-y",
    "-i", entreeImage,
    "-f", "lavfi", "-i", grain,
    "-i", entreeSon,
    "-filter_complex", graphe,
    "-map", "[v]", "-map", "2:a:0",
    // Lot M4b : `ultrafast` (3 fois moins de temps processeur que `veryfast`) ; fichier intermédiaire à CRF 12, plus gros.
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
    // Voix mono au CENTRE (double mono, −3 dB par canal) : le niveau intégré ne change pas.
    "-af", "pan=stereo|c0=0.7071*c0|c1=0.7071*c0",
    "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2",
    "-shortest", sortie,
  ];
}

/**
 * Graphe de l'EXPORT : calques texte posés en RVB (aucun décalage de teinte), retour YUV BT.709 étiqueté.
 * Lot M4b : le texte peut arriver en images de durées variables (une par état différent) ; `overlay` garde la
 * dernière image de texte arrivée tant que la suivante n'est pas due. Sans filtre `fps` : il faisait attendre le
 * master et en empilait les images (≈ 1 Go mesuré).
 */
export function grapheExport(source10bits = false, e: { master: string; texte: string; sortie: string; fils?: number; conversionRvbSure?: boolean } = { master: "[0:v]", texte: "[1:v]", sortie: "[v]" }): string {
  // FFmpeg 8 : `scale` (swscale) découpe l'image en tranches sur `threads` fils (1 par défaut) ; même résultat au bit près.
  const t = e.fils && e.fils > 1 ? `:threads=${Math.floor(e.fils)}` : "";
  // Facecam (B.8) : master 10 bits → texte posé en YUV 4:4:4 10 bits, puis UNE descente en 4:2:0 8 bits tramée.
  // 4:4:4 (09/10, FFmpeg 8.1.1 garanti par l'image et contrôlé avant chaque mise en ligne) : le texte est mélangé en
  // pleine chrominance puis sous-échantillonné une seule fois ; mesuré contre un mélange RVB flottant, la chrominance
  // aux bords du texte gagne ≈ 11 dB sur 4:2:2 (U 52,4 contre 40,9 dB). `yuv444p10` n'existe pas en FFmpeg 5.1.
  if (source10bits)
    return [
      `${e.master}${t ? `scale=${t.slice(1)},` : ""}format=yuv444p10le[m]`,
      `${e.texte}format=gbrap,scale=out_color_matrix=bt709:out_range=tv${t},format=yuva444p10le[t]`,
      "[m][t]overlay=format=yuv444p10:eof_action=pass[o]",
      `[o]scale=out_color_matrix=bt709:out_range=tv:sws_dither=ed${t},format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv${e.sortie}`,
    ].join(";");
  // 11/10 (tableau animé, demandé par `conversionRvbSure`) : FFmpeg 8.1.1 convertit `yuv420p → gbrp` en laissant
  // NOIRES les colonnes au-delà du dernier multiple de 16 (1072 à 1079 en 1 080 de large, mesuré) ; par `gbrap`, la
  // conversion est complète. Absent : graphe d'avant, inchangé.
  const rvb = e.conversionRvbSure ? "format=gbrap,format=gbrp" : "format=gbrp";
  return [
    `${e.master}scale=in_color_matrix=bt709:in_range=tv${t},${rvb}[m]`,
    `${e.texte}format=gbrap[t]`,
    "[m][t]overlay=format=gbrp:eof_action=pass[o]",
    `[o]scale=out_color_matrix=bt709:out_range=tv${t},format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv${e.sortie}`,
  ].join(";");
}

/**
 * Réglages vidéo communs aux deux passes (H.264 High 4.1, VBR, GOP fermé de 2 s). Préréglage `faster` (lot M4b) :
 * mesuré sur la démonstration au même débit, la ressemblance à l'image d'origine (SSIM) est la même qu'en `medium`
 * (0,9887 contre 0,9879 : le grain domine) pour un encodage 2 fois plus court.
 */
export function reglagesVideo(e: ParametresExport): string[] {
  const debit = modeExport(e) === "crf" ? ["-crf", String(e.crf ?? 17)] : ["-b:v", `${e.debitKbps}k`];
  return [
    "-c:v", "libx264", "-preset", "faster", "-profile:v", "high", "-level:v", "4.1",
    ...debit, "-maxrate", `${e.debitMaxKbps}k`, "-bufsize", `${Math.round(e.debitMaxKbps * 1.5)}k`,
    "-g", String(e.fps * 2), "-keyint_min", String(e.fps * 2), "-sc_threshold", "0", "-flags", "+cgop", "-bf", "2",
    "-pix_fmt", "yuv420p", "-r", String(e.fps),
    "-x264-params", `colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv${e.source10bits ? ":aq-mode=3" : ""}`,
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
  ];
}

/**
 * Mode de débit de l'export : celui de la demande, sauf `STUDIO_RENDU_EXPORT=2-passes` (ou `crf`) qui l'impose.
 * Absent : 2 passes (demandes d'avant le lot M4b).
 */
export function modeExport(e: Pick<ParametresExport, "mode">, env: Record<string, string | undefined> = process.env): "crf" | "2-passes" {
  const impose = env.STUDIO_RENDU_EXPORT?.trim();
  if (impose === "crf" || impose === "2-passes") return impose;
  return e.mode ?? "2-passes";
}

/**
 * FIN PROPRE (14/10) : l'image finale est tenue `tenueSec` (dernière image répétée, silence ajouté au son), puis image et
 * son s'effacent ensemble sur `fonduSec`, terminés à la dernière image. PUR, testé. `debutFonduSec` : instant du début
 * du fondu ; `dureeTotaleSec` : durée du fichier exporté ; `finMesureSec` : jusqu'où une mesure (VMAF) compare encore
 * l'export au master (avant tout fondu et avant la tenue).
 * `fps` (export réel du 14/10) : la dernière image est montrée à `durée − 1/fps`, le fondu y était encore à 91 % (deux
 * dernières images différentes, mesuré) ; de plus, `fade` n'atteint la pleine couleur qu'une image APRÈS `st + d`
 * (FFmpeg 6.1, mesuré). Le fondu finit donc `IMAGES_PLEINES_FIN` images avant la fin : les deux dernières images sont
 * identiques (pleine couleur). Absent : fondu terminé à la fin du fichier (calcul d'avant).
 */
export const IMAGES_PLEINES_FIN = 3;
export function filtresFinPropre(f: NonNullable<ParametresExport["finPropre"]>, fps?: number): { video: string; audio: string; debutFonduSec: number; dureeTotaleSec: number; finMesureSec: number } {
  const bon = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);
  const tenue = bon(f.tenueSec);
  const dureeTotaleSec = bon(f.dureeSec) + tenue;
  const marge = fps && fps > 0 ? Math.min(IMAGES_PLEINES_FIN / fps, tenue) : 0;
  const fondu = Math.min(bon(f.fonduSec), Math.max(0, dureeTotaleSec - marge));
  const debutFonduSec = Math.max(0, dureeTotaleSec - marge - fondu);
  const couleur = /^(0x[0-9a-fA-F]{6}|#[0-9a-fA-F]{6}|[a-z]{3,20})$/.test(f.couleur) ? f.couleur : "black";
  const t = (x: number) => x.toFixed(3);
  const fade = `fade=t=out:st=${t(debutFonduSec)}:d=${t(fondu)}:color=${couleur}`;
  return {
    video: `${tenue ? `tpad=stop_mode=clone:stop_duration=${t(tenue)},` : ""}${fade}`,
    audio: `${tenue ? `apad=pad_dur=${t(tenue)},` : ""}afade=t=out:st=${t(debutFonduSec)}:d=${t(fondu)}`,
    debutFonduSec,
    dureeTotaleSec,
    finMesureSec: Math.min(bon(f.dureeSec), debutFonduSec),
  };
}

/**
 * Arguments des deux passes de l'export final (en mode « crf » : `passe1` est vide, une seule passe). `texte` :
 * séquence PNG (`t-%06d.png`, une image par image), liste `.txt` du démultiplexeur `concat` (lot M4b : une image
 * par état différent, avec sa durée), ou vidéo transparente `.mov` (calques rendus par Remotion Lambda).
 */
export function argumentsExport(master: string, texte: string, e: ParametresExport, journal: string, sortie: string, fils?: number): { passe1: string[]; passe2: string[] } {
  // Fils = cœurs du conteneur (`cpus:` du compose) ; sinon FFmpeg prend ceux de toute la machine (mémoire et temps perdus).
  // 09/10 : `-filter_complex_threads` (et non `-filter_threads`, qui ne vise que les graphes simples `-vf` et restait
  // donc sans effet ici) ; `scale` découpé sur les mêmes fils. Sortie identique au bit près (mesuré, MD5).
  const f = fils && fils > 0 ? Math.floor(fils) : null;
  const fin = e.finPropre ? filtresFinPropre(e.finPropre, e.fps) : null;
  const entrees = [
    "-hide_banner", "-y", ...(f ? ["-filter_complex_threads", String(f)] : []), "-i", master, ...entreeTexte(texte, e.fps),
    "-filter_complex", grapheExport(!!e.source10bits, { master: "[0:v]", texte: "[1:v]", sortie: "[v]", ...(f ? { fils: f } : {}), ...(e.conversionRvbSure ? { conversionRvbSure: true } : {}) }) + (fin ? `;[v]${fin.video}[vf]` : ""), "-map", fin ? "[vf]" : "[v]", ...(f ? ["-threads", String(f)] : []),
  ];
  const son = [...(fin ? ["-af", fin.audio] : []), "-c:a", "aac", "-b:a", `${e.audioKbps}k`, "-ar", String(e.audioHz), "-ac", "2", "-movflags", "+faststart", "-shortest", sortie];
  if (modeExport(e) === "crf") return { passe1: [], passe2: [...entrees, "-map", "0:a:0", ...reglagesVideo(e), ...son] };
  return {
    passe1: [...entrees, ...reglagesVideo(e), "-pass", "1", "-passlogfile", journal, "-an", "-f", "null", "-"],
    passe2: [...entrees, "-map", "0:a:0", ...reglagesVideo(e), "-pass", "2", "-passlogfile", journal, ...son],
  };
}

/** Entrée FFmpeg du calque texte : liste `concat` (M4b), vidéo transparente (Remotion Lambda) ou séquence PNG. */
export function entreeTexte(texte: string, fps: number): string[] {
  if (texte.toLowerCase().endsWith(".txt")) return ["-f", "concat", "-safe", "0", "-i", texte];
  if (/\.(mov|webm)$/i.test(texte)) return ["-i", texte];
  return ["-framerate", String(fps), "-i", texte];
}

/**
 * NOTE DE QUALITÉ VMAF de l'export (09/10). Référence = exactement ce que x264 a reçu : le master et le texte repassés
 * dans le MÊME graphe d'export (`grapheExport`), jusqu'au `yuv420p` 8 bits tramé ; la note ne mesure donc que la perte
 * de l'encodage (le texte n'est pas compté comme un défaut). Coût réduit : une image sur `pas` est comparée
 * (`select` AVANT le graphe : le texte, le passage en 4:4:4 et le tramage ne sont calculés que pour ces images).
 */
export const VMAF = {
  /** Seuil par défaut (réglable : `export.vmafMin` de la demande, sinon `STUDIO_RENDU_VMAF_MIN`). */
  seuil: 93,
  /** Une image sur 5 (5 images par seconde à 25 i/s). */
  pas: 5,
  /** Relance UNIQUE sous le seuil : CRF plus bas de 3 (2 passes → CRF), jamais sous 12. */
  baisseCrf: 3,
  crfMin: 12,
  modele: "version=vmaf_v0.6.1",
} as const;

/**
 * Seuil de la note : `export.vmafMin` (demande) prime, puis `STUDIO_RENDU_VMAF_MIN` (paramètre caché du conteneur),
 * puis 93. `null` : note coupée (`STUDIO_RENDU_VMAF=non`). 0 : note mesurée, jamais d'alerte ni de relance.
 */
export function seuilVmaf(e: Pick<ParametresExport, "vmafMin">, env: Record<string, string | undefined> = process.env): number | null {
  if (["non", "0", "false"].includes((env.STUDIO_RENDU_VMAF ?? "").trim().toLowerCase())) return null;
  const lu = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN);
  for (const x of [lu(e.vmafMin), lu(env.STUDIO_RENDU_VMAF_MIN)]) if (Number.isFinite(x) && x >= 0 && x <= 100) return x;
  return VMAF.seuil;
}

/** Arguments de la mesure VMAF : `[0:v]` l'export décodé, `[1:v]` le master, `[2:v]` le texte ; journal JSON. */
export function argumentsVmaf(video: string, master: string, texte: string, e: ParametresExport, journal: string, fils?: number, pas: number = VMAF.pas): string[] {
  const f = fils && fils > 0 ? Math.floor(fils) : null;
  const k = Math.max(1, Math.floor(pas));
  // Fin propre : la mesure s'arrête avant la tenue et le fondu (l'export y diffère du master par construction).
  const coupeFin = e.finPropre ? `trim=end=${filtresFinPropre(e.finPropre, e.fps).finMesureSec.toFixed(3)},` : "";
  // Vérif A2 (10/10) : images choisies par INSTANT (même instant des deux côtés), plus par numéro : une image en moins
  // ou en double dans l'export décalait toutes les paires suivantes (note 55 au lieu de 97, relance CRF pour rien).
  const choix = k > 1 ? `select='not(mod(round(t*${e.fps})\\,${k}))',` : "";
  const graphe = [
    `[0:v]${coupeFin}setpts=PTS-STARTPTS,${choix}settb=AVTB[dist]`,
    `[1:v]${coupeFin}setpts=PTS-STARTPTS,${choix}settb=AVTB[mst]`,
    grapheExport(!!e.source10bits, { master: "[mst]", texte: "[2:v]", sortie: "[ref]", ...(f ? { fils: f } : {}), ...(e.conversionRvbSure ? { conversionRvbSure: true } : {}) }),
    `[dist][ref]libvmaf=model=${VMAF.modele}:log_fmt=json:log_path=${journal}:shortest=1${f ? `:n_threads=${f}` : ""}`,
  ].join(";");
  return ["-hide_banner", "-nostats", ...(f ? ["-filter_complex_threads", String(f)] : []), "-i", video, "-i", master, ...entreeTexte(texte, e.fps), "-filter_complex", graphe, "-an", "-f", "null", "-"];
}

export interface NoteVmaf {
  /** Moyenne des images comparées. */
  vmaf: number;
  /** Image la plus faible et 5e centile (un passage raté ne se cache pas dans la moyenne). */
  vmafMin: number;
  vmafP5: number;
  /** Images comparées (une sur `VMAF.pas`). */
  vmafImages: number;
}

/** Lit le journal JSON de libvmaf (PUR). */
export function lireVmaf(json: string): NoteVmaf {
  const j = JSON.parse(json) as { frames?: { metrics?: { vmaf?: number } }[]; pooled_metrics?: { vmaf?: { mean?: number; min?: number } } };
  const notes = (j.frames ?? []).map((x) => x.metrics?.vmaf).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!notes.length) throw new Error("Journal VMAF sans aucune image mesurée.");
  const tri = [...notes].sort((a, b) => a - b);
  const moyenne = j.pooled_metrics?.vmaf?.mean ?? notes.reduce((s, x) => s + x, 0) / notes.length;
  const arrondi = (x: number) => Math.round(x * 100) / 100;
  return { vmaf: arrondi(moyenne), vmafMin: arrondi(tri[0]), vmafP5: arrondi(tri[Math.floor((tri.length - 1) * 0.05)]), vmafImages: notes.length };
}

/**
 * Réglages de la relance UNIQUE sous le seuil : qualité constante, CRF plus bas de 3 (plancher 12) ; une demande en
 * 2 passes passe en CRF 14. Si `STUDIO_RENDU_EXPORT=2-passes` impose les 2 passes : débit moyen + 25 % (sous le
 * plafond). `null` : rien à gagner (déjà au plancher).
 */
export function exportRelance(e: ParametresExport, env: Record<string, string | undefined> = process.env): ParametresExport | null {
  if (env.STUDIO_RENDU_EXPORT?.trim() === "2-passes") {
    const debit = Math.min(e.debitMaxKbps, Math.round(e.debitKbps * 1.25));
    return debit > e.debitKbps ? { ...e, debitKbps: debit } : null;
  }
  const actuel = modeExport(e, env) === "crf" ? (e.crf ?? 17) : 17;
  const crf = Math.max(VMAF.crfMin, actuel - VMAF.baisseCrf);
  if (modeExport(e, env) === "crf" && crf >= actuel) return null;
  return { ...e, mode: "crf", crf };
}

/**
 * Liste du démultiplexeur `concat` des calques texte (lot M4b) : chaque image rendue tient `durees[i]` images de la
 * vidéo. La dernière est répétée sans durée (règle du format `concat` pour qu'elle soit lue jusqu'au bout).
 */
export function listeConcatTexte(fichiers: string[], durees: number[], fps: number): string {
  const lignes = ["ffconcat version 1.0"];
  // Noms de fichiers simples (t-000000.png) : aucune apostrophe à protéger.
  fichiers.forEach((f, i) => lignes.push(`file '${f}'`, `duration ${(durees[i] / fps).toFixed(6)}`));
  if (fichiers.length) lignes.push(`file '${fichiers[fichiers.length - 1]}'`);
  return lignes.join("\n") + "\n";
}

export interface MesuresExport {
  largeur: number;
  hauteur: number;
  fps: number;
  dureeSec: number;
  debitKbps: number;
  taille: number;
  /** 1 si primaires, transfert et matrice sont BT.709. */
  bt709: number;
  /** 1 si plage limitée (tv). */
  plageTv: number;
  /** 1 si `yuv420p`. */
  yuv420p: number;
  /** 1 si profil High, niveau × 10 (41). */
  profilHigh: number;
  niveau: number;
  audioHz: number;
  audioKbps: number;
  audioCanaux: number;
}

interface FluxProbe {
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  pix_fmt?: string;
  color_primaries?: string;
  color_transfer?: string;
  color_space?: string;
  color_range?: string;
  profile?: string;
  level?: number;
  sample_rate?: string;
  bit_rate?: string;
  channels?: number;
}

/** Lit la sortie JSON de ffprobe d'un fichier exporté (PUR). */
export function lireExport(json: string): MesuresExport {
  const p = JSON.parse(json) as { streams?: FluxProbe[]; format?: { duration?: string; size?: string; bit_rate?: string } };
  const v = p.streams?.find((s) => s.codec_type === "video") ?? {};
  const a = p.streams?.find((s) => s.codec_type === "audio") ?? {};
  const [n, d] = (v.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    largeur: v.width ?? 0,
    hauteur: v.height ?? 0,
    fps: d ? Math.round((n / d) * 100) / 100 : 0,
    dureeSec: Number(p.format?.duration ?? 0),
    debitKbps: Math.round(Number(p.format?.bit_rate ?? 0) / 1000),
    taille: Number(p.format?.size ?? 0),
    bt709: v.color_primaries === "bt709" && v.color_transfer === "bt709" && v.color_space === "bt709" ? 1 : 0,
    plageTv: v.color_range === "tv" ? 1 : 0,
    yuv420p: v.pix_fmt === "yuv420p" ? 1 : 0,
    profilHigh: v.profile === "High" ? 1 : 0,
    niveau: v.level ?? 0,
    audioHz: Number(a.sample_rate ?? 0),
    audioKbps: Math.round(Number(a.bit_rate ?? 0) / 1000),
    audioCanaux: a.channels ?? 0,
  };
}

/** `+faststart` : l'atome `moov` est AVANT `mdat` (lecture immédiate en ligne). Lit les boîtes de premier niveau. */
export function moovAvantMdat(entete: Buffer): boolean {
  let i = 0;
  while (i + 8 <= entete.length) {
    let taille = entete.readUInt32BE(i);
    const type = entete.toString("latin1", i + 4, i + 8);
    if (type === "moov") return true;
    if (type === "mdat") return false;
    if (taille === 1 && i + 16 <= entete.length) taille = Number(entete.readBigUInt64BE(i + 8));
    if (taille < 8) return false;
    i += taille;
  }
  return false;
}

/** Images noires en tête (`blackdetect`) : vrai si une plage noire commence à 0. */
export function imageNoireEnTete(sortieBlackdetect: string): boolean {
  return /black_start:\s*0(\.0+)?\b/.test(sortieBlackdetect);
}
