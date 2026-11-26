import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

// Chemin CALCULÉ (PIEGE-REMOTION-TSC.md) : les fichiers de studio-rendu ne sont lus que comme texte.
const dossier = (nom: string): string => join(process.cwd(), ["studio-rendu", "compositions", "interface-claire", "motion-v4", "lot6", nom].join("/"));
const TELEPHONE = readFileSync(dossier("TelephoneVideo.tsx"), "utf8");
const RENDUS = readFileSync(dossier("rendus-lot6.tsx"), "utf8");

const lignesBoxShadow = TELEPHONE.split("\n").filter((l) => l.includes("boxShadow"));
const largeurTelephone = (): number => {
  const m = /export const LARGEUR_TELEPHONE_VIDEO = (\d+);/.exec(RENDUS);
  if (!m) throw new Error("LARGEUR_TELEPHONE_VIDEO introuvable");
  return Number(m[1]);
};
/** Évalue le gabarit de boxShadow lu dans le fichier, pour une largeur donnée. */
const ombre = (largeur: number): string => {
  const m = /boxShadow: `([^`]*)`/.exec(lignesBoxShadow[0] ?? "");
  if (!m) throw new Error("boxShadow introuvable");
  return new Function("largeur", "COULEURS_LOT6", `return \`${m[1]}\`;`)(largeur, { GRIS: "#B0AEA5" }) as string;
};

/**
 * Texte du fichier SANS la ligne de commentaire « Ombre B … » et avec la valeur de boxShadow remplacée par un repère : tout le reste
 * doit être celui de master. Empreinte sha256 de ce texte sur master (e8b072ca, avant cette fiche), calculée une fois par :
 * `git show origin/master:studio-rendu/compositions/interface-claire/motion-v4/lot6/TelephoneVideo.tsx` passé par la même fonction.
 */
const sansOmbre = (t: string): string => t.split("\n").filter((l) => !/^\s*\/\/ Ombre B /.test(l)).join("\n").replace(/boxShadow: `[^`]*`/g, "boxShadow: `@OMBRE@`");
const EMPREINTE_MASTER_SANS_OMBRE = "e900c59b39a71659503591cff741f08e8c83ea7c4ba458dcc74c6167fb2f441e";

describe("TELEPHONE-OMBRE-v21t : ombre B douce et sombre sous le téléphone", () => {
  it("(a) ombre B : gabarit exact, plus d'ombre dure grise", () => {
    expect(lignesBoxShadow).toHaveLength(1);
    expect(lignesBoxShadow[0]).toContain("`0 ${Math.round(largeur * 0.02)}px ${Math.round(largeur * 0.05)}px rgba(20, 20, 19, 0.35)`");
    expect(lignesBoxShadow[0]).not.toContain("COULEURS_LOT6.GRIS");
  });

  it("(b) valeurs à la largeur du repli : 8 px de décalage bas, 21 px de flou, aucun décalage de côté", () => {
    expect(largeurTelephone()).toBe(420);
    expect(ombre(420)).toBe("0 8px 21px rgba(20, 20, 19, 0.35)");
    expect(ombre(560)).toBe("0 11px 28px rgba(20, 20, 19, 0.35)");
  });

  it("(c) rien d'autre : cadre, rayon, encoche, vidéo, aucun import du registre, et le reste du fichier identique à master", () => {
    expect(TELEPHONE).toContain("const cadre = Math.round(largeur * 0.03);");
    expect(TELEPHONE).toContain("const rayon = Math.round(largeur * 0.12);");
    expect(TELEPHONE).toContain("background: COULEURS_LOT6.ENCRE, padding: cadre, boxSizing: \"border-box\"");
    expect(TELEPHONE).toContain("<OffthreadVideo src={src as string}");
    expect(TELEPHONE).not.toMatch(/registre-v4/);
    // Le reste du fichier est IDENTIQUE à master (encoche, couleurs, tailles : toute autre modification rougit ici).
    expect(createHash("sha256").update(sansOmbre(TELEPHONE)).digest("hex")).toBe(EMPREINTE_MASTER_SANS_OMBRE);
  });
});
