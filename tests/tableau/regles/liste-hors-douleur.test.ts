/**
 * FIX-TABLEAU-LISTE-DOULEUR (18/11, brouillon v-64a273d3580c) : une scène de rôle accroche / douleur / idée reçue ne porte
 * jamais de liste (`code`, `coche`) ni de transformation, quelle que soit la partie déclarée de sa page.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { valider } from "./outils"; // charge `fiche` avant `gabarit-3` (ordre des imports du moteur)
import { copie } from "./exemples";
import { ficheDemonstration3Gestes, ficheMaquettes, ficheTemoinV667, ficheTemoinV667Corrige } from "../trois-styles/fiches";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { regleGabarit3 } from "../../../src/moteurs/montage-tableau/gabarit-3";

const DOSSIER = join(__dirname, "..", "temoins");
const lire = (nom: string): FicheTableau => {
  const j = JSON.parse(readFileSync(join(DOSSIER, nom), "utf8")) as FicheTableau | { fiche: FicheTableau };
  return "fiche" in j ? j.fiche : j; // une trace de fabrication enveloppe la fiche
};
const TEMOIN = lire("fiche-temoin-v-667edcd8e3a8-reference-3.json");

const DIT = "Un outil pour les devis. Un autre pour les e-mails. Un troisième pour les relances.";

/** Témoin : la scène s02 (rôle « douleur ») est re-déclarée page « solution » et reçoit trois lignes du bloc demandé. */
function avecListeSur(role: string, bloc: "code" | "coche" | "transformation", gabaritRole: string = "solution"): FicheTableau {
  const f = copie(TEMOIN);
  const s = f.scenes.find((x) => x.id === "s02")!;
  s.role = role as never;
  s.gabarit = { role: gabaritRole as never };
  s.texteDit = DIT;
  const textes = bloc === "transformation" ? ["Devis → Modèle"] : ["Un outil : devis", "Un autre : e-mails", "Un troisième : relances"];
  const ancres = [0, 5, 10];
  s.elements = textes.map((texte, i) => ({
    id: `l0${i + 1}`, type: "ligne" as const, texte, niveau: "texte" as const, role: "regle" as const, bloc, ancre: ancres[i],
    ...(bloc === "code" ? { code: (["vert", "orange", "rouge"] as const)[i] } : {}),
  })) as never;
  return f;
}

const manquements = (f: FicheTableau) => regleGabarit3(f).map((m) => m.detail);
const duNouveau = (f: FicheTableau) => manquements(f).filter((d) => d.includes("jamais en liste"));

describe("liste à pastilles hors douleur", () => {
  it("(a) liste « code » sur une scène de douleur d'une page déclarée « solution » → refusée, message qui nomme la ligne et la douleur", () => {
    const f = avecListeSur("douleur", "code");
    const m = duNouveau(f);
    expect(m.length).toBe(3);
    expect(m[0]).toContain("Un outil : devis");
    expect(m[0]).toContain("« douleur »");
    expect(valider(f).ok).toBe(false);
  });

  it("(b) « coche » → refusée ; « transformation » → refusée", () => {
    expect(duNouveau(avecListeSur("douleur", "coche")).length).toBe(3);
    expect(duNouveau(avecListeSur("douleur", "transformation")).length).toBe(1);
  });

  it("(b bis) scène « accroche » ou « idee-recue » : même refus", () => {
    expect(duNouveau(avecListeSur("accroche", "code")).length).toBe(3);
    expect(duNouveau(avecListeSur("idee-recue", "code")).length).toBe(3);
  });

  it("(c) mêmes lignes « code » sur une scène « etape » d'une page « solution » → aucun manquement neuf", () => {
    expect(duNouveau(avecListeSur("etape", "code"))).toEqual([]);
  });

  it("(d) tous les témoins reference-3 : aucun manquement neuf", () => {
    const noms = readdirSync(DOSSIER).filter((n) => n.includes("reference-3") || n.startsWith("fabrication-arretee-ecriture-a-l-heure"));
    expect(noms.length).toBeGreaterThan(0);
    for (const n of noms) expect({ n, m: duNouveau(lire(n)) }).toEqual({ n, m: [] });
    for (const f of [ficheTemoinV667(), ficheMaquettes(), ficheTemoinV667Corrige(), ficheDemonstration3Gestes()]) expect(duNouveau(f)).toEqual([]);
  });
});
