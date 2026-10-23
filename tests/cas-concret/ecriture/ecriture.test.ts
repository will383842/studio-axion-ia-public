/**
 * Écriture du cas concret (M3) : double de Claude et double du budget, aucun appel réel.
 * La réponse « de Claude » est la fiche simulée du rôle, éventuellement abîmée.
 */
import { describe, expect, it } from "vitest";
import { EMPLACEMENT_MOT, TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { recettePour } from "@/formats/cas-concret/recette";
import type { CasConcret } from "@/formats/cas-concret/cas";
import {
  APPELS_ECRITURE_MAX,
  CONSIGNE_ECRITURE,
  CONSIGNE_REFORMULATION,
  ecrireFiche,
  alertesPositionnement,
  jugerFiche,
  reformulerPhrase,
  roleEcritureCasConcret,
  roleReformulationCasConcret,
  variableEcriture,
  type EntreeEcriture,
} from "@/moteurs/montage-cas-concret/ecriture";
import { ficheTemoin } from "../temoin/fiche-temoin";
import { texteDuCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { DemandeReservationEcriture, OutilsEcriture, ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import { TOURNURES_APPEL, validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";

const FIXE = { videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", origine: "porte-a" } as const;
const cas = trouverCas("recrutement-apporteurs")!;

const entree = (c: CasConcret = cas): EntreeEcriture => ({ ...FIXE, cas: c });
const variable = (c: CasConcret) => variableEcriture(c, recettePour(c), FIXE);

/** Fiche simulée du rôle pour un cas (sortie de `simuler`, relue par `<cas-id>`). */
function ficheSimulee(c: CasConcret): FicheEcrans {
  const sortie = roleEcritureCasConcret.simuler({ contexte: {}, variable: variable(c) });
  if (typeof sortie === "string") throw new Error("aucune fiche simulée");
  return sortie;
}

interface Double extends OutilsEcriture {
  appels: EntreeRole[];
  roles: DefinitionRole[];
  reservations: DemandeReservationEcriture[];
}

/** Double : rend les réponses dans l'ordre, dans la forme de la production (X3 : `texte`, jamais `donnees`). */
function double(reponses: (FicheEcrans | string | object | ReponseAppelEcriture)[], budgetOk = true): Double {
  const d: Double = {
    appels: [],
    roles: [],
    reservations: [],
    async appeler(role, e) {
      d.roles.push(role);
      d.appels.push(e);
      const r = reponses[d.appels.length - 1];
      if (r === undefined) throw new Error("appel de trop");
      if (typeof r === "string") return { ok: true, simule: false, texte: r, stopReason: "end_turn" };
      if ("ok" in r) return r as ReponseAppelEcriture;
      return { ok: true, simule: false, texte: JSON.stringify(r), stopReason: "end_turn" };
    },
    budget: {
      async reserver(demande) {
        d.reservations.push(demande);
        return budgetOk ? { ok: true } : { ok: false, message: "Budget du mois atteint." };
      },
    },
  };
  return d;
}

/** Fiche dont un écran ajoute un nombre absent des faits (« 42 »). */
function ficheAvecNombre(): FicheEcrans {
  const f = structuredClone(ficheSimulee(cas));
  const e = f.ecrans.find((x) => x.type === "etape")!;
  e.texteDit = e.texteDit.replace(/\.$/, ", en 42 minutes.");
  return f;
}

describe("Simulation : une fiche valide par cas, bâtie par gabarit", () => {
  it.each(CATALOGUE.map((c) => [c.id, c] as const))("%s : la fiche simulée passe validerFicheEcrans", (_id, c) => {
    const f = ficheSimulee(c);
    const v = validerFicheEcrans(f, { cas: c, texteScript: texteDuCorps(f) });
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    expect(f.casId).toBe(c.id);
    expect(f.videoId).toBe(FIXE.videoId);
  });

  it.each(CATALOGUE.map((c) => [c.id, c] as const))("%s : aucune étape laissée de côté, les 22 règles passées", (_id, c) => {
    const f = ficheSimulee(c);
    expect(f.ecrans.filter((e) => e.type === "etape")).toHaveLength(c.etapes.length);
    const problemes = validerFicheEcrans(f, { cas: c, texteScript: texteDuCorps(f) });
    expect(problemes.ok).toBe(true);
  });

  it("contact-vers-crm : la promesse est dite « C.R.M. », sans passer en minuscules", () => {
    const c = trouverCas("contact-vers-crm")!;
    const f = ficheSimulee(c);
    expect(f.ecrans[0].texteDit).toBe("Vos contacts arrivent dans le C.R.M. sans ressaisie.");
    expect(f.ecrans.map((e) => e.texteDit).join(" ")).not.toMatch(/\bcrm\b/);
  });

  it("est déterministe et relit l'identifiant du cas", () => {
    expect(ficheSimulee(cas)).toEqual(ficheSimulee(cas));
    expect(variable(cas)).toContain(`<cas-id>${cas.id}</cas-id>`);
    expect(roleEcritureCasConcret.simuler({ contexte: {}, variable: "<cas-id>inconnu</cas-id>" })).toBe("");
  });

  it("ecrireFiche en simulation rend la fiche simulée en un appel", async () => {
    const d: OutilsEcriture = {
      appeler: async (role, e) => ({ ok: true, simule: true, donnees: role.simuler(e) }),
      budget: { reserver: async () => ({ ok: true }) },
    };
    const r = await ecrireFiche(entree(), d);
    expect(r.ok && r.simule && r.appels).toBe(1);
  });
});

describe("Rôle et consigne", () => {
  it("rôle d'écriture : identifiant, modèle d'écriture, sans schéma", () => {
    expect(roleEcritureCasConcret.id).toBe("ecriture-cas-concret");
    expect(roleEcritureCasConcret.modele).toBe(MODELE_ECRITURE);
    expect(roleEcritureCasConcret.modele).not.toMatch(/haiku/);
    expect("schema" in roleEcritureCasConcret).toBe(false);
    expect(roleReformulationCasConcret.id).toBe("reformulation-cas-concret");
  });

  it("la consigne et la partie variable ne contiennent aucune phrase de fin", () => {
    const phrasesDeFin = TABLE_FINS_DIAGNOSTIC.flatMap((l) => [l.dit, l.ecran]).flatMap((p) => p.split(EMPLACEMENT_MOT)).map((p) => p.replace(/[.,]$/, "").trim()).filter((p) => p.length > 8);
    for (const texte of [CONSIGNE_ECRITURE, CONSIGNE_REFORMULATION, ...CATALOGUE.map(variable)]) {
      const bas = texte.toLowerCase();
      for (const p of phrasesDeFin) expect(bas).not.toContain(p.toLowerCase());
      for (const t of TOURNURES_APPEL) expect(bas).not.toContain(t);
    }
    expect(CONSIGNE_ECRITURE).toContain("la fin de la vidéo");
  });
});

describe("ecrireFiche : budget, relance, échec", () => {
  it("fiche acceptée du premier coup : un appel, réservé avant", async () => {
    const d = double([ficheSimulee(cas)]);
    const r = await ecrireFiche(entree(), d);
    expect(r.ok && r.appels).toBe(1);
    expect(d.reservations).toHaveLength(1);
    expect(d.reservations[0]).toMatchObject({ videoId: "video-1", modele: MODELE_ECRITURE });
    expect(d.reservations[0].coutEstimeUsd).toBeGreaterThan(0);
  });

  it("budget refusé : aucun appel", async () => {
    const d = double([ficheSimulee(cas)], false);
    const r = await ecrireFiche(entree(), d);
    expect(r).toMatchObject({ ok: false, motif: "budget", appels: 0 });
    expect(d.appels).toHaveLength(0);
  });

  it("réponse refusée puis corrigée : 2 appels, la relance porte les refus", async () => {
    const d = double([ficheAvecNombre(), ficheSimulee(cas)]);
    const r = await ecrireFiche(entree(), d);
    expect(r.ok && r.appels).toBe(2);
    expect(r.ok && r.relance).toBe(true);
    expect(d.reservations).toHaveLength(2);
    expect(d.appels[1].variable).toContain("<refus_fiche_precedente>");
    expect(d.appels[1].variable).toContain("42");
  });

  it("deux refus : échec en français, jamais de troisième appel", async () => {
    const d = double([ficheAvecNombre(), "pas du JSON", ficheSimulee(cas)]);
    const r = await ecrireFiche(entree(), d);
    expect(r).toMatchObject({ ok: false, motif: "refusee", appels: APPELS_ECRITURE_MAX });
    expect(d.appels).toHaveLength(2);
    if (!r.ok) {
      expect(r.message).toMatch(/refusée après 2 essais/);
      expect(r.refus.join(" ")).toMatch(/JSON/);
    }
  });

  it("une réponse qui ajoute un nombre est refusée (nombres des faits)", async () => {
    const d = double([ficheAvecNombre(), ficheAvecNombre()]);
    const r = await ecrireFiche(entree(), d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus.some((m) => m.includes("nombres des faits") && m.includes("42"))).toBe(true);
  });

  it("X9 · un champ figé changé est remplacé par celui du cas, et l'écart est noté", async () => {
    const f = { ...ficheSimulee(cas), casId: "rappels-rendez-vous" };
    const d = double([f, f]);
    const r = await ecrireFiche(entree(), d);
    expect(r.ok && r.fiche.casId).toBe(cas.id);
    expect(r.ok && r.appels).toBe(1);
    if (r.ok) expect(r.notes.some((m) => m.includes("« casId »") && m.includes("rappels-rendez-vous"))).toBe(true);
  });

  it("appel en échec : arrêt motivé, sans relance", async () => {
    const d = double([{ ok: false, arret: "plafond", message: "Plafond de la vidéo atteint." }]);
    const r = await ecrireFiche(entree(), d);
    expect(r).toMatchObject({ ok: false, motif: "appel", appels: 1 });
  });
});

describe("reformulerPhrase : un appel, mêmes nombres, pas plus de mots", () => {
  const phrase = "Nous, on arrive pour la visio : quinze minutes.";
  const appel = { videoId: "video-1", appelId: "video-1-p3" };

  it("reformulation acceptée", async () => {
    const d = double([{ phrase: "On arrive pour la visio : quinze minutes." }]);
    const r = await reformulerPhrase(phrase, cas.faits, d, appel);
    expect(r).toEqual({ ok: true, phrase: "On arrive pour la visio : quinze minutes." });
    expect(d.appels).toHaveLength(1);
    expect(d.reservations).toHaveLength(1);
    expect(d.roles[0].id).toBe("reformulation-cas-concret");
  });

  it("une reformulation qui change un nombre est refusée, sans second appel", async () => {
    const d = double([{ phrase: "Nous arrivons pour la visio : vingt minutes." }, { phrase: phrase }]);
    const r = await reformulerPhrase(phrase, cas.faits, d, appel);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/nombres/);
    expect(d.appels).toHaveLength(1);
  });

  it("une reformulation plus longue est refusée", async () => {
    const d = double([JSON.stringify({ phrase: "Nous, nous arrivons ensuite pour la visio : quinze minutes." })]);
    const r = await reformulerPhrase(phrase, cas.faits, d, appel);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/mots/);
  });

  it("budget refusé : aucun appel", async () => {
    const d = double([{ phrase }], false);
    const r = await reformulerPhrase(phrase, cas.faits, d, appel);
    expect(r.ok).toBe(false);
    expect(d.appels).toHaveLength(0);
  });

  it("simulation : la phrase rendue telle quelle", () => {
    expect(roleReformulationCasConcret.simuler({ contexte: {}, variable: `<phrase>${phrase}</phrase>` })).toEqual({ phrase });
  });
});

describe("X1 · durée visée et écrans voisins", () => {
  // V4-2 (mission F) : la visée passe de 45–55 s à 40–47 s (la v4, référence de style, fait 41 s ; les essais réels
  // duraient de 48 à 56 s) ; les bornes de refus de R21 (35 à 65 s) ne changent pas.
  it("la consigne avertit : jamais deux écrans sur deux mots voisins ; la sortie la plus courte de 40 à 47 s", async () => {
    const { CONSIGNE_ECRITURE } = await import("@/moteurs/montage-cas-concret/ecriture");
    expect(CONSIGNE_ECRITURE).toContain("Jamais deux écrans sur deux mots voisins");
    expect(CONSIGNE_ECRITURE).toContain("la vidéo la plus COURTE (celle de la fin la plus courte) dure de 40 à 47 s");
    expect(CONSIGNE_ECRITURE).toContain("une fin courte demande plus d'écrans dans le corps");
  });

  it("B3 · la consigne plafonne l'écran à 15 mots (débit prudent) et demande UNE SEULE IDÉE", async () => {
    const { CONSIGNE_ECRITURE } = await import("@/moteurs/montage-cas-concret/ecriture");
    expect(CONSIGNE_ECRITURE).toContain("de 4 à 15 mots dits par écran");
    expect(CONSIGNE_ECRITURE).toContain("14 si l'écran a une avance");
    expect(CONSIGNE_ECRITURE).toContain("UNE SEULE IDÉE");
    expect(CONSIGNE_ECRITURE).toContain("écran liste-avant : 36 mots dits au plus");
    expect(CONSIGNE_ECRITURE).not.toContain("17 mots");
    expect(CONSIGNE_ECRITURE).not.toContain("un écran « titre » de transition qui redit la promesse");
  });

  it("le corps visé fait tenir la sortie la plus courte de 40 à 47 s, la plus longue sous 65 s", async () => {
    const { corpsVise } = await import("@/moteurs/montage-cas-concret/ecriture");
    expect(corpsVise({ plusCourteMs: 8_000, plusLongueMs: 14_000 })).toEqual({ minMs: 32_000, maxMs: 39_000 });
    // Fin longue : la borne de 65 s l'emporte sur les 47 s de la plus courte.
    expect(corpsVise({ plusCourteMs: 8_000, plusLongueMs: 30_000 })).toEqual({ minMs: 32_000, maxMs: 35_000 });
  });
});

describe("B3 · positionnement : alerte seulement", () => {
  it("la fiche simulée ne porte aucune note de positionnement", () => {
    const r = jugerFiche(ficheSimulee(cas), entree());
    expect(r.ok).toBe(true);
    expect(r.notes.filter((n) => /^Positionnement/.test(n))).toEqual([]);
  });

  it("« faites-le vous-même » dans un texte d'écran : une note Positionnement, le verdict ne change pas", () => {
    const f = structuredClone(ficheSimulee(cas));
    const q = f.ecrans[f.ecrans.length - 1];
    expect(q.type).toBe("question");
    if (q.type === "question") q.question = "Faites-le vous-même ?";
    const r = jugerFiche(f, entree());
    expect(r.notes.filter((n) => /^Positionnement/.test(n))).toHaveLength(1);
    expect(r.notes.find((n) => /^Positionnement/.test(n))).toContain("Faites-le vous-même ?");
    const sans = jugerFiche(ficheSimulee(cas), entree());
    expect(r.ok).toBe(sans.ok);
  });

  it("diyImperatif : libellé « renvoie le spectateur à le faire seul »", () => {
    const f = structuredClone(ficheSimulee(cas));
    const q = f.ecrans[f.ecrans.length - 1];
    if (q.type === "question") q.question = "Faites-le vous-même ?";
    const a = alertesPositionnement(f);
    expect(a).toHaveLength(1);
    expect(a[0]).toContain("renvoie le spectateur à le faire seul : dites ce que nous mettons en place pour lui");
  });

  it("NOUVEAUTE_OUTIL : libellé « annonce un outil nouveau »", () => {
    const f = structuredClone(ficheSimulee(cas));
    const q = f.ecrans[f.ecrans.length - 1];
    if (q.type === "question") q.question = "Un nouvel outil vient de sortir ?";
    const a = alertesPositionnement(f);
    expect(a).toHaveLength(1);
    expect(a[0]).toContain("annonce un outil nouveau : montrez ce que nous faisons pour lui, pas l'outil");
    expect(a[0]).not.toContain("à le faire seul");
  });

  it("la fiche témoin de la v4 ne porte aucune alerte de positionnement", () => {
    expect(alertesPositionnement(ficheTemoin())).toEqual([]);
  });
});
