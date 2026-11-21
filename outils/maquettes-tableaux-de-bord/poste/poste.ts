// T-EXT-51a : le poste de capture est-il le bon ? Pur : aucune lecture de disque, aucun réseau, aucun navigateur, ne lève jamais.
// Les sondes sont lues par `verifier-poste.mts` ; ici on ne fait que les juger et en tirer une fiche d'identité (`poste.json`).
import { createHash } from "node:crypto";
import { environnementAutorise } from "../capture/garde";

export const EXIGENCES_POSTE = {
  /** Lue dans `pnpm-lock.yaml` par le test : jamais devinée. */
  playwright: "1.63.0",
  ffmpegMajeurMin: 6,
  filtres: ["libx264", "ssim", "freezedetect", "blackdetect"],
  plateformes: ["linux"],
  police: "src/app/polices/manrope-latin.woff2",
  espaceLibreMinMo: 2000,
} as const;

export interface SondesPoste {
  plateforme: string;
  env: { CI?: string; CLAUDE_CODE_REMOTE?: string; CAPTURE_CONTENEUR?: string };
  /** Lu sur le disque par le lanceur (`indicesConteneur(existsSync)`) : /.dockerenv ou /run/.containerenv présent. */
  indicesConteneur?: boolean;
  playwright?: string;
  chromium?: { chemin: string; version: string };
  ffmpeg?: { version: string; encodeurs: string[]; filtres: string[] };
  ffprobe?: string;
  policeSha256?: string;
  espaceLibreMo?: number;
}

export interface Jugement {
  ok: boolean;
  manques: string[];
  remarques: string[];
}

/** « ffmpeg version 8.1.1-static … » → « 8.1.1 » ; « 6.1.1-3ubuntu5 » → « 6.1.1 » ; sinon `undefined`. */
export function lireVersionFfmpeg(texte: string): string | undefined {
  const m = /ffmpeg version\s+n?(\d+(?:\.\d+)*)/i.exec(texte ?? "");
  return m ? m[1] : undefined;
}

/** Noms des filtres de `ffmpeg -filters` (colonne 2 de chaque ligne de la liste). */
export function lireFiltres(texteFiltres: string): string[] {
  const noms: string[] = [];
  for (const ligne of String(texteFiltres ?? "").split(/\r?\n/)) {
    const m = /^\s*[A-Z.|]{3}\s+(\S+)\s+\S+->\S+\s/.exec(ligne);
    if (m) noms.push(m[1]);
  }
  return noms;
}

/** Noms des encodeurs de `ffmpeg -encoders` (lignes « V....D libx264  … »). */
export function lireEncodeurs(texteEncodeurs: string): string[] {
  const noms: string[] = [];
  for (const ligne of String(texteEncodeurs ?? "").split(/\r?\n/)) {
    const m = /^\s*[VAS][A-Z.]{5}\s+([A-Za-z0-9][\w.-]*)\s/.exec(ligne);
    if (m) noms.push(m[1]);
  }
  return noms;
}

function majeur(version: string): number {
  const n = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isFinite(n) ? n : -1;
}

export function jugerPoste(s: SondesPoste): Jugement {
  const manques: string[] = [];
  const remarques: string[] = [];
  const env = s?.env ?? {};
  const plateforme = s?.plateforme ?? "";

  const verdict = environnementAutorise(env as Record<string, string | undefined>, plateforme, s?.indicesConteneur === true);
  if (!verdict.ok) manques.push(verdict.raison);
  if (plateforme && !(EXIGENCES_POSTE.plateformes as readonly string[]).includes(plateforme)) {
    manques.push(`Système « ${plateforme} » refusé : seulement Linux (cloud ou CI).`);
  }
  if (s?.playwright !== EXIGENCES_POSTE.playwright) {
    manques.push(`Playwright ${EXIGENCES_POSTE.playwright} requis (trouvé : ${s?.playwright ?? "aucun"}).`);
  }
  if (!s?.chromium?.chemin) manques.push("Chromium introuvable (indiquer CAPTURE_CHROMIUM=<chemin>, sans réinstaller Playwright).");
  else if (!s.chromium.version) remarques.push("Version de Chromium illisible.");

  if (!s?.ffmpeg) manques.push("FFmpeg introuvable.");
  else {
    if (majeur(s.ffmpeg.version) < EXIGENCES_POSTE.ffmpegMajeurMin) {
      manques.push(`FFmpeg ${EXIGENCES_POSTE.ffmpegMajeurMin} ou plus requis (trouvé : ${s.ffmpeg.version || "version illisible"}).`);
    }
    for (const f of EXIGENCES_POSTE.filtres) {
      if (!s.ffmpeg.filtres.includes(f) && !s.ffmpeg.encodeurs.includes(f)) manques.push(`FFmpeg sans « ${f} ».`);
    }
  }
  if (!s?.ffprobe) remarques.push("ffprobe introuvable ou illisible.");
  if (!s?.policeSha256) manques.push(`Police introuvable : ${EXIGENCES_POSTE.police}.`);
  if (typeof s?.espaceLibreMo !== "number") remarques.push("Espace libre non mesuré.");
  else if (s.espaceLibreMo < EXIGENCES_POSTE.espaceLibreMinMo) {
    manques.push(`Espace libre insuffisant : ${Math.round(s.espaceLibreMo)} Mo (au moins ${EXIGENCES_POSTE.espaceLibreMinMo} Mo).`);
  }
  return { ok: manques.length === 0, manques, remarques };
}

/** sha256 de { playwright, chromium.version, ffmpeg.version, policeSha256 } : jamais un chemin ni une heure. */
export function empreintePoste(s: SondesPoste): string {
  const base = {
    chromium: s?.chromium?.version ?? null,
    ffmpeg: s?.ffmpeg?.version ?? null,
    playwright: s?.playwright ?? null,
    policeSha256: s?.policeSha256 ?? null,
  };
  return createHash("sha256").update(JSON.stringify(base)).digest("hex");
}

export type TypePoste = "routine-cloud" | "ci" | "conteneur";

/** « conteneur » seulement avec CAPTURE_CONTENEUR exactement « true » ET sans indice absent (`false` = le lanceur n'a vu aucun fichier témoin). */
export function typePoste(env: SondesPoste["env"], indicesConteneur?: boolean): TypePoste {
  if (env?.CAPTURE_CONTENEUR === "true" && indicesConteneur !== false) return "conteneur";
  if (env?.CI === "true" && env?.CLAUDE_CODE_REMOTE !== "true") return "ci";
  return "routine-cloud";
}

export function posteJson(s: SondesPoste, jugement: Jugement) {
  // `indicesConteneur` sert au jugement et au type seulement : il n'entre pas dans la fiche.
  const { env, ...sondes } = s;
  delete sondes.indicesConteneur;
  return {
    version: "poste-capture.v1" as const,
    type: typePoste(env ?? {}, s?.indicesConteneur),
    ...sondes,
    empreinte: empreintePoste(s),
    ok: jugement.ok,
    manques: jugement.manques,
  };
}
