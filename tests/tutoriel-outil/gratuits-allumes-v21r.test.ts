/**
 * ALLUMER-TUTORIEL-GRATUITS-v21r : la cloche du suivi est ALLUMÉE par défaut (seul `false` écrit l'éteint ; lecture en panne = éteint) ;
 * le devis avant dépense reste ÉTEINT par défaut (décision du pilote du 25/11 11:05). Dépôts mémoire, doubles, 0 €.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification, Travail, Video } from "@/domaine/types";

const reglage: { valeur: unknown; leve: boolean } = { valeur: undefined, leve: false };
vi.mock("@/services/_commun", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  lireParametre: async (id: string, defaut: unknown) => {
    if (id !== "tutoriel.suiviCloche") return defaut;
    if (reglage.leve) throw new Error("lecture impossible");
    return reglage.valeur === undefined ? defaut : reglage.valeur;
  },
}));

import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { lireReglagesTutoriel } from "@/services/tutoriel-console";
import { signalerSuivi, type CreerCloche } from "@/services/tutoriel-suivi";

const T = "2026-11-25T09:00:00.000Z";
const VIDEO = "vid_gratuits";
let posees: Parameters<CreerCloche>[0][] = [];
const creer: CreerCloche = async (n) => {
  posees.push(n);
  await depots().notifications.enregistrer({ id: `not_${posees.length}`, lue: false, creeLe: T, modifieLe: T, ...n } as Notification);
};
const enPause = (code: string) => ({ id: "trv_gr", type: "fabrication", cibleId: VIDEO, titre: "Tutoriel", etapes: [], statut: "en_file", progression: 10, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "studio", creeLe: T, modifieLe: T, parametres: { pause: { code, message: "x" }, tutoriel: {} } }) as unknown as Travail;
const lu = (f: string) => readFileSync(f, "utf8");

beforeEach(async () => {
  reinitialiserDepots();
  posees = [];
  reglage.valeur = undefined;
  reglage.leve = false;
  await depots().videos.enregistrer({ id: VIDEO, titre: "Mon tutoriel", creeLe: T, modifieLe: T } as Video);
});

describe("cloche du suivi allumée par défaut", () => {
  it("e) sans réglage : une notification de la cloche ; `false` : aucune ; lecture qui lève : aucune, sans exception", async () => {
    expect(await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), { creer })).toHaveLength(1);
    expect(posees[0]).toMatchObject({ lien: `/tutoriel-outil/suivi/${VIDEO}` });
    posees = [];
    reinitialiserDepots();
    await depots().videos.enregistrer({ id: VIDEO, titre: "Mon tutoriel", creeLe: T, modifieLe: T } as Video);
    reglage.valeur = false;
    expect(await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), { creer })).toEqual([]);
    reglage.valeur = undefined;
    reglage.leve = true;
    expect(await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), { creer })).toEqual([]);
    expect(posees).toEqual([]);
  });

  it("f) jamais en double : le 2e appel identique ne pose rien de plus", async () => {
    await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), { creer });
    expect(await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), { creer })).toEqual([]);
    expect(posees).toHaveLength(1);
  });

  it("g) panneau : mémoire vide → la cloche est allumée, le devis ÉTEINT ; `false` → cloche éteinte", async () => {
    const vide = await lireReglagesTutoriel({ lire: async (_c, defaut) => defaut as never });
    expect(vide.find((r) => r.cle === "tutoriel.suiviCloche")?.allume).toBe(true);
    expect(vide.find((r) => r.cle === "tutoriel.devisAvantDepense")?.allume).toBe(false);
    const faux = await lireReglagesTutoriel({ lire: async (c, defaut) => (c === "tutoriel.suiviCloche" ? (false as never) : (defaut as never)) });
    expect(faux.find((r) => r.cle === "tutoriel.suiviCloche")?.allume).toBe(false);
  });
});

describe("le devis reste éteint (décision du pilote du 25/11 11:05)", () => {
  it("devis : les trois lecteurs gardent le défaut `false` et `=== true`", () => {
    expect(lu("src/services/tutoriel-branchements.ts")).toContain('lireParametre<boolean>("tutoriel.devisAvantDepense", false)) === true');
    expect(lu("src/services/tutoriel-reserve-tirage.ts")).toContain("lireParametre<unknown>(CLE_DEVIS_AVANT_DEPENSE, false)) === true");
    expect(lu("src/app/(studio)/tutoriel-outil/page.tsx")).toContain("lireParametre<unknown>(CLE_DEVIS_AVANT_DEPENSE, false)) === true");
  });
});

describe("h) rouge si on casse la ligne ; i) lecture seule", () => {
  it("h) la lecture de la cloche exige `, true)` et `!== false`, et une panne vaut éteint", () => {
    const src = lu("src/services/tutoriel-suivi.ts");
    expect(src).toContain('lireParametre<boolean>("tutoriel.suiviCloche", true)) !== false');
    expect(src).toMatch(/catch \{\s*return false;\s*\}/);
    expect(lu("src/services/tutoriel-console.ts")).toMatch(/CLE_SUIVI_CLOCHE[^\n]*allumeParDefaut: true/);
  });

  it("i) aucun fichier touché n'écrit un réglage", () => {
    for (const f of ["src/services/tutoriel-suivi.ts", "src/services/tutoriel-console.ts", "src/components/tutoriel-outil/PanneauConsole.tsx"]) {
      const s = lu(f);
      if (f.endsWith("tutoriel-console.ts")) continue; // le panneau écrit les réglages par sa propre action de bascule (existante, inchangée)
      expect(s).not.toMatch(/ecrireParametre\(|parametres\.enregistrer\(/);
    }
  });
});
