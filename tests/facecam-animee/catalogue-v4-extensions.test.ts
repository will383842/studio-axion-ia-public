/** C4-U4.9a-a : fiche du téléphone qui joue un extrait + catalogue ouvert par option. Aucun rendu, aucun réseau. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_V4, etatVisagePoseV4, ficheV4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import {
  catalogueV4Ouvert, FICHE_TELEPHONE_VIDEO_V4 as FICHE, ficheV4Ouverte, ID_TELEPHONE_VIDEO_V4,
} from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4-extensions";

const RACINE = process.cwd();
const NEUF = join(RACINE, "src/moteurs/montage-facecam-animee/realisateur/catalogue-v4-extensions.ts");
const RENDUS = readFileSync(join(RACINE, "studio-rendu/compositions/interface-claire/motion-v4/lot6/rendus-lot6.tsx"), "utf8");

describe("éteint : le catalogue est celui de toujours", () => {
  it.each([[undefined], [{}], [{ telephoneVideo: false }], [{ telephoneVideo: "true" }], [{ telephoneVideo: 1 }]])("options %j", (o) => {
    expect(catalogueV4Ouvert(o as never)).toBe(CATALOGUE_V4);
  });
  it("la fiche du téléphone est inconnue, les 26 ids passent par ficheV4", () => {
    expect(ficheV4Ouverte(ID_TELEPHONE_VIDEO_V4)).toBeUndefined();
    expect(ficheV4Ouverte(ID_TELEPHONE_VIDEO_V4, { telephoneVideo: "true" })).toBeUndefined();
    expect(CATALOGUE_V4).toHaveLength(26);
    for (const f of CATALOGUE_V4) expect(ficheV4Ouverte(f.id, { telephoneVideo: true })).toBe(ficheV4(f.id));
  });
});

describe("allumé : un nouveau tableau de 27", () => {
  it("26 premières identiques, la 27e est le téléphone, gelé, catalogue intact", () => {
    const ouvert = catalogueV4Ouvert({ telephoneVideo: true });
    expect(ouvert).toHaveLength(27);
    CATALOGUE_V4.forEach((f, i) => expect(ouvert[i]).toBe(f));
    expect(ouvert[26]).toBe(FICHE);
    expect(Object.isFrozen(ouvert)).toBe(true);
    expect(ouvert).not.toBe(CATALOGUE_V4);
    expect(CATALOGUE_V4).toHaveLength(26);
    expect(ficheV4Ouverte(ID_TELEPHONE_VIDEO_V4, { telephoneVideo: true })).toBe(FICHE);
  });
});

describe("cohérence avec N-17 (lecture du texte)", () => {
  it("id, emplacement et fichier", () => {
    expect(RENDUS).toContain(`ID_TELEPHONE_VIDEO = "${ID_TELEPHONE_VIDEO_V4}"`);
    expect(RENDUS).toContain(`SLOT_TELEPHONE_VIDEO = "${FICHE.slot}"`);
    expect(FICHE.id).toBe(ID_TELEPHONE_VIDEO_V4);
    expect(existsSync(join(RACINE, FICHE.fichier))).toBe(true);
  });
});

describe("fiche", () => {
  it("muet, une vidéo, gabarit de FenetreTelephone, visage jamais à moitié", () => {
    const ft = ficheV4("FenetreTelephone") as typeof CATALOGUE_V4[number];
    expect(Object.isFrozen(FICHE)).toBe(true);
    expect(FICHE.sons).toEqual([]);
    expect(FICHE.videos).toEqual([1, 1]);
    expect(FICHE.gabarit).toBe(ft.gabarit);
    expect(FICHE.descente).toBe(ft.descente);
    expect(FICHE.sousTitres).toBe(ft.sousTitres);
    expect(FICHE.dureeSec).toEqual(ft.dureeSec);
    expect(FICHE.evts).toEqual(ft.evts);
    expect(etatVisagePoseV4(FICHE)).not.toBe("partiel");
  });
});

describe("garde : pur et non branché", () => {
  it("le fichier neuf n'importe rien de studio-rendu ni de réglage", () => {
    const t = readFileSync(NEUF, "utf8");
    expect(t).not.toMatch(/from\s+["'][^"']*studio-rendu/);
    expect(t).not.toMatch(/lireParametre|server-only/);
  });
  it("aucun fichier de src/ ne l'importe, sauf regles-v4.ts (seul importeur permis)", () => {
    // MAJ 17/11 (C4-U4.9a-b, voulue, à relire) : `regles-v4.ts` importe `ficheV4Ouverte` pour le paramètre facultatif
    // `telephoneVideo` de `resoudreElementsV4`. Garde intacte : tout AUTRE fichier de src/ qui l'importe reste refusé.
    const IMPORTEUR_PERMIS = join(RACINE, "src", "moteurs", "montage-facecam-animee", "realisateur", "regles-v4.ts");
    const vus: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n) && p !== NEUF && p !== IMPORTEUR_PERMIS && readFileSync(p, "utf8").includes("catalogue-v4-extensions")) vus.push(p);
      }
    };
    parcourir(join(RACINE, "src"));
    expect(vus).toEqual([]);
  });
});
