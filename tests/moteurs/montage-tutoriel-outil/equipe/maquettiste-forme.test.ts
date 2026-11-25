/**
 * PHRASE-1 : la consigne du maquettiste décrit la forme EXACTE de `description-maquette.v1`, avec un exemple tiré d'une constante
 * du code. Ces tests prouvent que l'exemple passe le lecteur ET le contrôle des textes créés : la consigne ne peut plus diverger.
 * Aucun appel réel : 0 €.
 */
import { describe, expect, it } from "vitest";
import type { DefinitionRole } from "@/generateur/roles/types";
import { lireDescriptionMaquette, ECRANS_MAX, ZONES_MAX, TYPES_ZONE, MODELE_TABLEAU_DE_BORD } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { completerManque, CONSIGNE_MAQUETTISTE, entreeMaquettiste, exempleSortieMaquette, roleMaquettiste, schemaSortieMaquettiste } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { controlerTextesCrees } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { NOMS_NEUTRES } from "@/services/tutoriel-piece-creee";
import { PHRASE_STOCKS, SORTIE_REELLE_SERVEUR } from "./sortie-reelle-phrase1";

const INTERDITS = NOMS_NEUTRES.interdits;
describe("PHRASE-1 · l'exemple de la consigne passe le lecteur ET le contrôle des textes créés", () => {
  it("lireDescriptionMaquette accepte l'exemple, tel qu'écrit dans la consigne", () => {
    const m = CONSIGNE_MAQUETTISTE.match(/\n(\{"manque":"maquette".*\})\n/);
    expect(m).not.toBeNull();
    const dansConsigne = JSON.parse(m![1]!);
    expect(dansConsigne).toEqual(JSON.parse(JSON.stringify(exempleSortieMaquette())));
    expect(schemaSortieMaquettiste.safeParse(dansConsigne).success).toBe(true);
    const lu = lireDescriptionMaquette(dansConsigne.contenu, { interdits: INTERDITS, modelesConnus: [] });
    expect(lu.ok).toBe(true);
    // Rien n'est corrigé en silence : la lecture rend la même description.
    if (lu.ok) expect(lu.description).toEqual(dansConsigne.contenu);
  });

  it("controlerTextesCrees ne relève aucun défaut sur l'exemple (avec et sans noms permis)", () => {
    const { contenu } = exempleSortieMaquette();
    expect(controlerTextesCrees(contenu, [])).toEqual([]);
    expect(controlerTextesCrees(contenu, ["Espace démo · Boîte de réception"])).toEqual([]);
  });

  it("l'exemple traverse completerManque de bout en bout (proposition, jamais « à revoir »)", async () => {
    const p = await completerManque({ manque: "maquette", contexte: { metier: "selon la demande", carteZones: [], interdits: INTERDITS, demande: PHRASE_STOCKS, proposition: 1 }, appeler: async () => exempleSortieMaquette() });
    expect(p.statut).toBe("proposition");
  });

  it("la consigne cite les constantes du lecteur (champs, types, bornes, modèle) et « aucun autre champ »", () => {
    for (const mot of ["version", "nom", "entreprise", "metier", "ecrans", "etats", "id", "modele", "titre", "zones", "type", "libelle", "donnees", "valeur", "exemple", "etat"]) expect(CONSIGNE_MAQUETTISTE).toContain(mot);
    for (const t of TYPES_ZONE) expect(CONSIGNE_MAQUETTISTE).toContain(t);
    expect(CONSIGNE_MAQUETTISTE).toContain(`« ${MODELE_TABLEAU_DE_BORD} »`);
    expect(CONSIGNE_MAQUETTISTE).toContain(`1 à ${ECRANS_MAX}`);
    expect(CONSIGNE_MAQUETTISTE).toContain(`1 à ${ZONES_MAX}`);
    expect(CONSIGNE_MAQUETTISTE).toMatch(/AUCUN autre champ/);
    expect(CONSIGNE_MAQUETTISTE).toMatch(/jamais « titre »/);
    expect(CONSIGNE_MAQUETTISTE).toMatch(/minuscules, chiffres et tirets, 40 caractères au plus/);
    expect(CONSIGNE_MAQUETTISTE).toContain("<remarques_precedentes>");
  });

  it("la phrase de l'utilisateur reste une donnée : dans `variable`, jamais dans la consigne", () => {
    const e = entreeMaquettiste("maquette", { metier: "selon la demande", carteZones: [], interdits: [], demande: PHRASE_STOCKS, proposition: 1 });
    expect(e.variable).toContain(`<demande>${PHRASE_STOCKS.replace(/&/g, "&amp;")}</demande>`);
    expect(CONSIGNE_MAQUETTISTE).not.toContain("stocks d'une PME");
    expect(roleMaquettiste.consigne).toBe(CONSIGNE_MAQUETTISTE);
  });
});

describe("PHRASE-1 · la sortie du serveur (reconstitution, voir sortie-reelle-phrase1.ts) est refusée, avec les remarques relevées", () => {
  it("lireDescriptionMaquette : « titre » inconnu dans les zones, libellé absent, modèle sans identifiant", () => {
    const r = lireDescriptionMaquette(SORTIE_REELLE_SERVEUR.contenu, { interdits: INTERDITS });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Le relevé en compte 6 (tronquées à 6) ; ce double reconstitué en donne 7 (zone 3 sans libellé en plus) : au moins 6, jamais moins.
    expect(r.erreurs.length).toBeGreaterThanOrEqual(6);
    expect(r.erreurs.join(" | ")).toContain("Écran 1 : modèle : identifiant attendu");
    expect(r.erreurs.join(" | ")).toContain("Écran 1, zone 1 : champ inconnu « titre »");
    expect(r.erreurs.join(" | ")).toContain("Écran 1, zone 1 : libellé : texte attendu, non vide.");
  });

  it("completerManque : « à revoir » avec ces remarques, jamais une sortie corrigée en silence", async () => {
    const p = await completerManque({ manque: "maquette", contexte: { metier: "selon la demande", carteZones: [], interdits: INTERDITS, demande: PHRASE_STOCKS, proposition: 1 }, appeler: async () => SORTIE_REELLE_SERVEUR });
    expect(p.statut).toBe("a-revoir");
  });
});

describe("PHRASE-1 · la simulation passe toujours", () => {
  const simuler = (e: Parameters<NonNullable<DefinitionRole["simuler"]>>[0]) => (roleMaquettiste as unknown as DefinitionRole).simuler(e);
  it("avec une demande, et sans demande : une description lue et contrôlée", () => {
    for (const demande of [PHRASE_STOCKS, undefined]) {
      const sortie = simuler(entreeMaquettiste("maquette", { metier: "selon la demande", carteZones: [], interdits: [], ...(demande ? { demande, proposition: 1 as const } : {}) })) as { manque: string; contenu: unknown };
      expect(schemaSortieMaquettiste.safeParse(sortie).success).toBe(true);
      const lu = lireDescriptionMaquette(sortie.contenu, { interdits: INTERDITS });
      expect(lu.ok).toBe(true);
      if (lu.ok) expect(controlerTextesCrees(lu.description, [])).toEqual([]);
    }
  });
});
