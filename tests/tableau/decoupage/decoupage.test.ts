/**
 * Découpage automatique en scènes (TB-12) : double de Claude et double du budget, aucun appel réel.
 * Fiche de référence : l'exemple « L'erreur corrigée » de TB-01, avec le script dont elle est tirée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DefinitionRole, EntreeRole } from "../../../src/generateur/roles/types";
import { MODELE_ECRITURE } from "../../../src/fournisseurs/claude/tarifs";
import {
  APPELS_MAX,
  CONSIGNE_DECOUPAGE,
  decouperEnScenes,
  roleDecoupageTableau,
  type DemandeReservation,
  type EntreeDecoupage,
  type OutilsDecoupage,
  type ReponseAppelDecoupage,
} from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";

const fiche = ficheErreurCorrigee;

function entree(extra: Partial<EntreeDecoupage> = {}): EntreeDecoupage {
  const { texteScript, ...controle } = contexteExemple(fiche);
  return {
    texteScript,
    structure: fiche.structure,
    serie: fiche.serie,
    douleur: fiche.douleur,
    gesteMinute: fiche.gesteMinute,
    preuves: [{ id: "matiere-demo-questions", resume: "Même demande, avec et sans les trois questions." }],
    dessins: [
      { id: "point-interrogation", motsCles: ["question", "doute"] },
      { id: "bulle", motsCles: ["parole", "réponse"] },
    ],
    videoId: fiche.videoId,
    versionId: fiche.versionId,
    habillage: fiche.habillage,
    stylo: fiche.stylo,
    ratio: fiche.ratio,
    controle,
    ...extra,
  };
}

/** Fiche dont le texte dit change d'UN mot (« vagues » → « floues »). */
function ficheMotChange(): FicheTableau {
  const f = copie(fiche);
  f.scenes[0].texteDit = f.scenes[0].texteDit.replace("vagues", "floues");
  return f;
}

interface Double extends OutilsDecoupage {
  appels: EntreeRole[];
  roles: DefinitionRole[];
  reservations: DemandeReservation[];
}

/** Double : rend les réponses dans l'ordre (une fiche est rendue en texte JSON, comme Claude). */
function double(reponses: (FicheTableau | string | ReponseAppelDecoupage)[], budgetOk: boolean | ((n: number) => boolean) = true): Double {
  const d: Double = {
    appels: [],
    roles: [],
    reservations: [],
    async appeler(role, e) {
      d.roles.push(role);
      d.appels.push(e);
      const r = reponses[d.appels.length - 1];
      if (r === undefined) throw new Error("appel de trop");
      if (typeof r === "string") return { ok: true, simule: false, donnees: r };
      if ("ok" in r) return r;
      return { ok: true, simule: false, donnees: JSON.stringify(r) };
    },
    budget: {
      async reserver(demande) {
        d.reservations.push(demande);
        const ok = typeof budgetOk === "function" ? budgetOk(d.reservations.length) : budgetOk;
        return ok ? { ok: true } : { ok: false, message: "Budget du mois atteint." };
      },
    },
  };
  return d;
}

describe("préalables", () => {
  it("le script de l'exemple est bien celui de la fiche", () => {
    expect(entree().texteScript).toBe(texteScriptDe(fiche));
  });

  it("modèle d'écriture du studio, jamais un modèle Haiku", () => {
    expect(roleDecoupageTableau.modele).toBe(MODELE_ECRITURE);
    expect(roleDecoupageTableau.modele).not.toMatch(/haiku/i);
  });

  it("la consigne impose mot pour mot, dessins et preuves fournis, sans appel, vouvoiement, sans numéro", () => {
    expect(CONSIGNE_DECOUPAGE).toMatch(/MOT POUR MOT, dans l'ordre, sans rien ajouter ni retirer/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/« dessinId » vient de la liste <dessins> fournie/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/« preuveId » vient de la liste <preuves> fournie/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/Aucune phrase d'appel/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/Vouvoiement/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/Aucun numéro d'épisode/);
  });
});

describe("decouperEnScenes", () => {
  it("sortie valide du premier coup : 1 appel, fiche rendue telle quelle", async () => {
    const d = double([fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(r).toEqual({ ok: true, fiche, appels: 1, relance: false });
    expect(d.appels).toHaveLength(1);
    expect(d.roles[0]).toBe(roleDecoupageTableau);
    // Données envoyées : script, dessins et preuves fournis, champs fixes.
    const v = d.appels[0].variable;
    expect(v).toContain(`<script_valide>\n${texteScriptDe(fiche)}\n</script_valide>`);
    expect(v).toContain("point-interrogation · question, doute");
    expect(v).toContain("matiere-demo-questions · ");
    expect(v).toContain(`"videoId":"${fiche.videoId}"`);
  });

  it("réservation du coût estimé AVANT chaque appel", async () => {
    const d = double([fiche]);
    await decouperEnScenes(entree(), d);
    expect(d.reservations).toHaveLength(1);
    expect(d.reservations[0]).toMatchObject({ videoId: fiche.videoId, modele: MODELE_ECRITURE });
    expect(d.reservations[0].coutEstimeUsd).toBeGreaterThan(0);
  });

  it("sortie invalide puis valide : exactement 2 appels, la relance porte les refus", async () => {
    const d = double([ficheMotChange(), fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(r).toEqual({ ok: true, fiche, appels: 2, relance: true });
    expect(d.appels).toHaveLength(2);
    expect(d.reservations).toHaveLength(2);
    expect(d.reservations[0].appelId).not.toBe(d.reservations[1].appelId);
    const relance = d.appels[1].variable;
    expect(relance).toContain("<refus_fiche_precedente>");
    expect(relance).toMatch(/texte dit mot pour mot/);
    expect(relance).toContain("floues");
  });

  it("deux sorties invalides : échec motivé, 2 appels, jamais 3", async () => {
    const d = double([ficheMotChange(), ficheMotChange(), fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(APPELS_MAX);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motif).toBe("refusee");
    expect(r.appels).toBe(2);
    expect(r.message).toMatch(/refusée par les règles après 2 essais/);
    expect(r.refus.length).toBeGreaterThan(0);
    // Le travail payé n'est jamais jeté : la dernière fiche lisible est rendue « à corriger », telle que rendue.
    expect(r.aCorriger?.scenes[0].texteDit).toContain("floues");
  });

  it("texte dit modifié d'un mot : refus, jamais corrigé en silence", async () => {
    const changee = ficheMotChange();
    const d = double([changee, changee]);
    const r = await decouperEnScenes(entree(), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refus).toEqual([expect.stringContaining("le mot 5 du texte dit est « floues », le script validé dit « vagues »")]);
    expect(r.refus[0]).toContain("règle « texte dit mot pour mot »");
  });

  it("budget refusé : aucun appel", async () => {
    const d = double([fiche], false);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(0);
    expect(r).toMatchObject({ ok: false, motif: "budget", appels: 0 });
    if (!r.ok) expect(r.message).toContain("Budget du mois atteint.");
  });

  it("budget refusé pour la relance : un seul appel, refus gardés", async () => {
    const d = double([ficheMotChange(), fiche], (n) => n === 1);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(1);
    expect(r).toMatchObject({ ok: false, motif: "budget", appels: 1 });
    if (!r.ok) expect(r.refus.join(" ")).toMatch(/texte dit mot pour mot/);
  });

  it("JSON mal formé : refus lisible, relance, puis échec sans 3e appel", async () => {
    const d = double(["{ \"version\": \"fiche-scenes/1\", ", "Voici la fiche : {}"]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(2);
    expect(d.appels[1].variable).toMatch(/n'est pas un JSON lisible/);
    expect(r).toMatchObject({ ok: false, motif: "illisible", appels: 2 });
    if (!r.ok) {
      expect(r.refus).toEqual([expect.stringMatching(/^La réponse n'est pas un JSON lisible/)]);
      expect(r.aCorriger).toBeUndefined();
    }
  });

  it("réponse COUPÉE (raison d'arrêt « max_tokens ») : issue « tronquee », jamais rejouée à l'identique", async () => {
    const coupee = JSON.stringify(fiche).slice(0, 2000);
    const d = double([{ ok: true, simule: false, donnees: coupee, stopReason: "max_tokens" }, fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(1);
    expect(r).toMatchObject({ ok: false, motif: "tronquee", appels: 1 });
    if (!r.ok) expect(r.message).toMatch(/la réponse a été coupée/i);
  });

  it("JSON entouré d'un bloc de code Markdown : lu (la forme seulement, aucune réparation)", async () => {
    const d = double(["```json\n" + JSON.stringify(fiche, null, 2) + "\n```"]);
    const r = await decouperEnScenes(entree(), d);
    expect(r).toEqual({ ok: true, fiche, appels: 1, relance: false });
  });

  it("JSON mal formé puis valide : fiche acceptée au 2e appel", async () => {
    const d = double(["pas du JSON", fiche]);
    const r = await decouperEnScenes(entree(), d);
    expect(r).toEqual({ ok: true, fiche, appels: 2, relance: true });
  });

  it("dessin hors de la liste fournie : refus", async () => {
    const r = await decouperEnScenes(entree({ dessins: [{ id: "bulle", motsCles: [] }] }), double([fiche, fiche]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus).toContain("Scène s01 : le dessin « point-interrogation » n'est pas dans la liste fournie.");
  });

  it("preuve hors de la liste fournie : refus", async () => {
    const r = await decouperEnScenes(entree({ preuves: [] }), double([fiche, fiche]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus).toContain("Scène s05 : la preuve « matiere-demo-questions » n'est pas dans la liste fournie.");
  });

  it("champ fixe changé (série) : refus", async () => {
    const f = copie(fiche);
    f.serie = { code: f.serie.code, nom: "Autre nom" };
    const r = await decouperEnScenes(entree(), double([f, f]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus.join(" ")).toMatch(/La série doit être recopiée telle quelle/);
  });

  it("appel refusé par le chemin de dépense : échec, pas de relance", async () => {
    const d = double([{ ok: false, arret: "plafond-video", message: "Plafond de la vidéo atteint." }]);
    const r = await decouperEnScenes(entree(), d);
    expect(d.appels).toHaveLength(1);
    expect(r).toMatchObject({ ok: false, motif: "appel", appels: 1 });
  });

  it("simulation (Claude non relié) : aucune fiche inventée", async () => {
    const r = await decouperEnScenes(entree(), double([{ ok: true, simule: true }]));
    expect(r).toMatchObject({ ok: false, motif: "simulation" });
  });
});

describe("isolement", () => {
  it("n'importe aucun autre moteur, aucun client de fournisseur, du générateur des types seulement", () => {
    const source = readFileSync(join(__dirname, "../../../src/moteurs/montage-tableau/decoupage.ts"), "utf8");
    const imports = [...source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm)].map((m) => ({ type: !!m[1], chemin: m[2] }));
    for (const i of imports) {
      expect(i.chemin).not.toMatch(/moteurs\/(?!montage-tableau)|^\.\.\//);
      expect(i.chemin).not.toMatch(/fournisseurs\/claude\/client|@anthropic-ai/);
      if (i.chemin.startsWith("@/generateur")) expect(i.type).toBe(true);
    }
    expect(source).not.toMatch(/\bfetch\(/);
  });
});
