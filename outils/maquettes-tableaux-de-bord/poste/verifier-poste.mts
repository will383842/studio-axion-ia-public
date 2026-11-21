/**
 * T-EXT-51a : vérifie le poste de capture et écrit sa fiche d'identité `poste.json` (cloud ou CI seulement, jamais le PC).
 *
 *   pnpm exec tsx outils/maquettes-tableaux-de-bord/poste/verifier-poste.mts --sortie <dossier hors dépôt>
 *
 * Codes : 0 poste bon · 4 entrée refusée · 7 poste refusé (hors cloud/CI, ou manques listés).
 * Ne lance PAS le navigateur (même pas about:blank), aucune requête réseau, aucun appel au Studio. Jamais appelé par le Studio.
 */
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statfsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { environnementAutorise, indicesConteneur } from "../capture/garde";
import { EXIGENCES_POSTE, jugerPoste, lireEncodeurs, lireFiltres, lireVersionFfmpeg, posteJson, type SondesPoste } from "./poste";

const RACINE_DEPOT = fileURLToPath(new URL("../../../", import.meta.url));

function lancer(commande: string, args: string[]): string | undefined {
  try {
    const r = spawnSync(commande, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 20000 });
    if (r.error || r.status !== 0) return undefined;
    return `${r.stdout ?? ""}${r.stderr ?? ""}`;
  } catch {
    return undefined;
  }
}

function lirePlaywright(): string | undefined {
  try {
    const j = JSON.parse(readFileSync(join(RACINE_DEPOT, "node_modules/@playwright/test/package.json"), "utf8")) as { version?: unknown };
    return typeof j.version === "string" ? j.version : undefined;
  } catch {
    return undefined;
  }
}

function sondeChromium(): SondesPoste["chromium"] {
  let chemin: string | undefined = process.env.CAPTURE_CHROMIUM || undefined;
  if (!chemin) {
    try {
      chemin = chromium.executablePath(); // ne lance rien
    } catch {
      chemin = undefined;
    }
  }
  if (!chemin) return undefined;
  const sortie = lancer(chemin, ["--version"]);
  if (sortie === undefined) return undefined;
  const m = /(\d+(?:\.\d+)+)/.exec(sortie);
  return { chemin, version: m ? m[1] : "" };
}

function main(): number {
  const a = process.argv.slice(2);
  const i = a.indexOf("--sortie");
  const sortieBase = i >= 0 ? a[i + 1] : undefined;
  if (!sortieBase) {
    console.error("Indiquez --sortie <dossier hors dépôt>.");
    return 4;
  }
  const sortie = resolve(sortieBase);
  if (sortie === RACINE_DEPOT.replace(/\/$/, "") || sortie.startsWith(RACINE_DEPOT)) {
    console.error("La sortie doit être hors du dépôt.");
    return 4;
  }

  const garde = environnementAutorise(process.env, process.platform, indicesConteneur(existsSync));
  if (!garde.ok) {
    console.error(garde.raison);
    return 7;
  }

  const ffV = lancer("ffmpeg", ["-hide_banner", "-version"]);
  const ffF = lancer("ffmpeg", ["-hide_banner", "-filters"]);
  const ffE = lancer("ffmpeg", ["-hide_banner", "-encoders"]);
  const probe = lancer("ffprobe", ["-version"]);
  let policeSha256: string | undefined;
  try {
    policeSha256 = createHash("sha256").update(readFileSync(join(RACINE_DEPOT, EXIGENCES_POSTE.police))).digest("hex");
  } catch {
    policeSha256 = undefined;
  }
  let espaceLibreMo: number | undefined;
  try {
    mkdirSync(sortie, { recursive: true });
    const f = statfsSync(sortie);
    espaceLibreMo = Math.floor((f.bavail * f.bsize) / (1024 * 1024));
  } catch {
    espaceLibreMo = undefined;
  }

  const pw = lirePlaywright();
  const chrome = sondeChromium();
  const sondes: SondesPoste = {
    plateforme: process.platform,
    indicesConteneur: indicesConteneur(existsSync),
    env: {
      ...(process.env.CI !== undefined ? { CI: process.env.CI } : {}),
      ...(process.env.CLAUDE_CODE_REMOTE !== undefined ? { CLAUDE_CODE_REMOTE: process.env.CLAUDE_CODE_REMOTE } : {}),
      ...(process.env.CAPTURE_CONTENEUR !== undefined ? { CAPTURE_CONTENEUR: process.env.CAPTURE_CONTENEUR } : {}),
    },
    ...(pw ? { playwright: pw } : {}),
    ...(chrome ? { chromium: chrome } : {}),
    ...(ffV !== undefined
      ? { ffmpeg: { version: lireVersionFfmpeg(ffV) ?? "", encodeurs: lireEncodeurs(ffE ?? ""), filtres: lireFiltres(ffF ?? "") } }
      : {}),
    ...(probe !== undefined ? { ffprobe: lireVersionFfmpeg(probe.replace(/ffprobe/i, "ffmpeg")) ?? "inconnue" } : {}),
    ...(policeSha256 ? { policeSha256 } : {}),
    ...(espaceLibreMo !== undefined ? { espaceLibreMo } : {}),
  };
  const jugement = jugerPoste(sondes);
  const fiche = posteJson(sondes, jugement);
  writeFileSync(join(sortie, "poste.json"), JSON.stringify(fiche, null, 2) + "\n");
  if (!jugement.ok) {
    console.error(`Poste insuffisant :\n- ${jugement.manques.join("\n- ")}`);
    return 7;
  }
  console.log(`Poste bon (${fiche.type}) · empreinte ${fiche.empreinte.slice(0, 12)} · ${join(sortie, "poste.json")}`);
  return 0;
}

process.exit(main());
