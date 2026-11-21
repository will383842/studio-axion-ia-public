/**
 * T-EXT-34 · Vue des rôles et journal : fonctions pures, aucun service, aucun appel payant (0 €).
 */
import { describe, expect, it } from "vitest";
import type { EtapeTravail } from "@/domaine/types";
import { lireJournalRoles, noterRole, ROLES, type LigneJournal } from "@/moteurs/montage-tutoriel-outil/journal-roles";
import { PHRASE_DEVIS_A_ACCEPTER, PHRASE_DEVIS_ATTEINT, PHRASE_OUTILS_ATTENDUS, PHRASE_SAUTE, vueRoles, type TravailPourVue } from "@/moteurs/montage-tutoriel-outil/vue-roles";

const MOTS_TECHNIQUES = ["JSON", "API", "LLM", "prompt", "rendu Remotion", "zip"];

const etape = (cle: string, statut: EtapeTravail["statut"]): EtapeTravail => ({ cle, nom: cle, icone: "film", dependDe: [], statut, progression: statut === "terminee" ? 100 : 0, sortieFichierIds: [] });
const travail = (statuts: Partial<Record<string, EtapeTravail["statut"]>>, parametres?: Record<string, unknown>, statut: TravailPourVue["statut"] = "en_cours"): TravailPourVue => ({
  statut,
  etapes: Object.entries(statuts).map(([c, s]) => etape(c, s!)),
  parametres,
});
const ligne = (role: LigneJournal["role"], etat: LigneJournal["etat"], resume?: string): LigneJournal => ({ role, etat, le: "2026-11-18T09:00:00.000Z", ...(resume ? { resume } : {}) });
const etatDe = (l: ReturnType<typeof vueRoles>, r: string) => l.find((x) => x.role === r)!;

describe("vue des rôles, sans journal (master d'aujourd'hui)", () => {
  it("montre les 10 rôles dans l'ordre de l'équipe, sans ligne Voix ni Montage", () => {
    const v = vueRoles(travail({ script: "en_attente", voix: "en_attente", calage: "en_attente", plan: "en_attente", montage: "en_attente", exports: "en_attente" }));
    expect(v.map((l) => l.role)).toEqual([...ROLES]);
    expect(v.map((l) => l.libelle)).toEqual(["Chef de projet", "Analyste", "Maquettiste", "Stratège de valeur", "Scénariste", "Réalisateur", "Directeur motion", "Contrôleur", "Regardeur", "Documentaliste"]);
    expect(v.some((l) => /voix|montage/i.test(l.libelle))).toBe(false);
  });

  it("déduit le scénariste de « script » et le réalisateur de « calage » et « plan »", () => {
    const v = vueRoles(travail({ script: "terminee", voix: "terminee", calage: "terminee", plan: "en_cours", montage: "en_attente" }));
    expect(etatDe(v, "scenariste").etat).toBe("fait");
    expect(etatDe(v, "realisateur").etat).toBe("en-cours");
    for (const r of ROLES.filter((x) => x !== "scenariste" && x !== "realisateur")) expect(etatDe(v, r).etat).toBe("a-venir");
    expect(etatDe(vueRoles(travail({ script: "terminee", calage: "terminee", plan: "terminee" })), "realisateur").etat).toBe("fait");
    expect(etatDe(vueRoles(travail({ script: "en_cours", calage: "en_attente", plan: "en_attente" })), "scenariste").etat).toBe("en-cours");
  });

  it("une étape en échec met le rôle « à revoir »", () => {
    expect(etatDe(vueRoles(travail({ script: "terminee", calage: "echec", plan: "en_attente" }, undefined, "echec")), "realisateur").etat).toBe("a-revoir");
  });

  it("pause TO_SCRIPT_A_VALIDER : le scénariste attend Williams", () => {
    const l = etatDe(vueRoles(travail({ script: "en_cours" }, { pause: { code: "TO_SCRIPT_A_VALIDER", message: "x" } }, "en_file")), "scenariste");
    expect(l.etat).toBe("attend-williams");
    expect(l.attendWilliams).toBe(true);
  });

  it("pause TO_DEVIS_A_ACCEPTER : « attend-williams » ; TO_DEVIS_ATTEINT aussi, avec sa phrase", () => {
    const a = etatDe(vueRoles(travail({ script: "en_attente" }, { pause: { code: "TO_DEVIS_A_ACCEPTER" } }, "en_file")), "chef-de-projet");
    expect(a).toMatchObject({ etat: "attend-williams", phrase: PHRASE_DEVIS_A_ACCEPTER, attendWilliams: true });
    const b = etatDe(vueRoles(travail({ script: "en_attente" }, { pause: { code: "TO_DEVIS_ATTEINT" } }, "en_file")), "chef-de-projet");
    expect(b).toMatchObject({ etat: "attend-williams", phrase: PHRASE_DEVIS_ATTEINT });
  });

  it("pause TO_OUTILS_NON_RELIES : personne n'attend Williams (donc aucune cloche)", () => {
    const v = vueRoles(travail({ script: "en_attente" }, { pause: { code: "TO_OUTILS_NON_RELIES" } }, "en_file"));
    expect(v.some((l) => l.attendWilliams || l.etat === "a-revoir")).toBe(false);
    expect(etatDe(v, "chef-de-projet").phrase).toBe(PHRASE_OUTILS_ATTENDUS);
  });
});

describe("vue des rôles, avec journal", () => {
  it("un journal complet : ordre fixe, dernière ligne de chaque rôle", () => {
    let e: object = {};
    e = noterRole(e, ligne("scenariste", "en-cours"));
    e = noterRole(e, ligne("chef-de-projet", "fait"));
    e = noterRole(e, ligne("scenariste", "attend-williams"));
    for (const r of ROLES.filter((x) => x !== "scenariste" && x !== "chef-de-projet")) e = noterRole(e, ligne(r, "fait"));
    const v = vueRoles(travail({ script: "en_cours" }, { tutoriel: e }));
    expect(v.map((l) => l.role)).toEqual([...ROLES]);
    expect(etatDe(v, "scenariste").etat).toBe("attend-williams");
    expect(etatDe(v, "chef-de-projet").phrase).toBe("Le chef de projet a classé votre demande.");
  });

  it("un journal mal formé : vue déduite des étapes, aucune exception", () => {
    for (const roles of ["pas une liste", 12, null, [null, 4, { role: "inconnu", etat: "fait", le: "x" }, { role: "analyste", etat: "bizarre", le: "x" }]]) {
      const v = vueRoles(travail({ script: "terminee", calage: "en_attente", plan: "en_attente" }, { tutoriel: { roles } }));
      expect(v).toHaveLength(10);
      expect(etatDe(v, "scenariste").etat).toBe("fait");
    }
    expect(vueRoles({ statut: "en_cours", etapes: [], parametres: { tutoriel: "abîmé" } })).toHaveLength(10);
    expect(vueRoles({ statut: "en_cours", etapes: [] })).toHaveLength(10);
  });

  it("un rôle sauté affiche « Pas nécessaire : votre dossier était complet »", () => {
    const e = noterRole({}, ligne("maquettiste", "saute"));
    const l = etatDe(vueRoles(travail({}, { tutoriel: e })), "maquettiste");
    expect(l.phrase).toBe(PHRASE_SAUTE);
    expect(l.phrase).toContain("Pas nécessaire");
  });

  it("le contrôleur « à revoir » dit qu'un point est à revoir et montre son résumé (120 caractères au plus)", () => {
    const e = noterRole({}, ligne("controleur", "a-revoir", "x".repeat(300)));
    const l = etatDe(vueRoles(travail({}, { tutoriel: e })), "controleur");
    expect(l.phrase).toBe("Le contrôleur a trouvé un point à revoir.");
    expect(l.detail).toHaveLength(120);
  });
});

describe("journal des rôles", () => {
  it("noterRole ne modifie pas l'objet d'entrée et n'efface aucune ligne", () => {
    const avant = { ratios: ["4:5"], roles: [ligne("analyste", "en-cours")] };
    const copie = JSON.parse(JSON.stringify(avant));
    const apres = noterRole(avant, ligne("analyste", "fait"));
    expect(avant).toEqual(copie);
    expect(apres.roles).toHaveLength(2);
    expect(apres.roles[0]).toEqual(avant.roles[0]);
    expect(apres).not.toBe(avant);
    expect(apres.ratios).toEqual(["4:5"]);
  });

  it("lireJournalRoles garde la dernière ligne par rôle et tolère tout", () => {
    const e = noterRole(noterRole({}, ligne("analyste", "en-cours")), ligne("analyste", "fait"));
    expect(lireJournalRoles({ tutoriel: e })).toEqual([expect.objectContaining({ role: "analyste", etat: "fait" })]);
    for (const p of [undefined, null, 3, "x", {}, { tutoriel: null }, { tutoriel: { roles: "x" } }]) expect(lireJournalRoles(p)).toEqual([]);
  });

  it("un résumé trop long est coupé, une ligne mal formée est refusée", () => {
    expect(noterRole({}, ligne("analyste", "fait", "y".repeat(500))).roles[0].resume).toHaveLength(120);
    const mauvaise = { role: "x", etat: "fait", le: "z" } as unknown as LigneJournal;
    expect(noterRole({}, mauvaise).roles).toEqual([]);
  });
});

describe("mots simples", () => {
  it("aucune phrase ne contient de mot technique, de rôle et d'état confondus", () => {
    const etats = ["a-venir", "en-cours", "attend-williams", "fait", "a-revoir", "saute"] as const;
    const phrases: string[] = [];
    for (const etat of etats) {
      let e: object = {};
      for (const r of ROLES) e = noterRole(e, ligne(r, etat));
      phrases.push(...vueRoles(travail({}, { tutoriel: e })).map((l) => l.phrase));
    }
    phrases.push(PHRASE_DEVIS_A_ACCEPTER, PHRASE_DEVIS_ATTEINT, PHRASE_OUTILS_ATTENDUS, PHRASE_SAUTE);
    expect(phrases.length).toBeGreaterThan(60);
    for (const p of phrases) {
      for (const mot of MOTS_TECHNIQUES) expect(p.toLowerCase()).not.toContain(mot.toLowerCase());
      expect(p).not.toMatch(/\b(tu|ton|ta|tes)\b/i);
      expect(p).not.toMatch(/(Douleur|Solution|Exemple|À vous)\s*:/);
    }
  });
});

describe("AUD-5 : toutes les pauses du tutoriel se lisent", () => {
  const CODES = ["TO_SCRIPT_A_VALIDER", "TO_SCRIPT_ABSENT", "TO_SCRIPT_NON_ECRIT", "TO_DEVIS_A_ACCEPTER", "TO_DEVIS_ATTEINT", "TO_OUTILS_NON_RELIES", "TO_FILM_A_CAPTURER", "TO_DOSSIER_INCOMPLET", "TO_DEMANDE_VIDE", "TO_DEMANDE_ARRETEE", "TO_EQUIPE_BLOQUEE", "TO_PIECE_A_CONSTRUIRE", "TO_PIECE_A_VALIDER", "TO_PIECE_A_REVOIR"];
  const base = vueRoles(travail({ script: "en_attente" }));

  it.each(CODES)("%s change au moins une ligne", (code) => {
    const v = vueRoles(travail({ script: "en_attente" }, { pause: { code, message: "m" } }, "en_file"));
    expect(v.some((l, i) => l.phrase !== base[i].phrase || l.etat !== base[i].etat)).toBe(true);
  });

  it("un code inconnu affiche le message de la pause", () => {
    const v = vueRoles(travail({ script: "en_attente" }, { pause: { code: "TO_NOUVEAU", message: "Rien n'a échoué, patientez." } }, "en_file"));
    expect(etatDe(v, "chef-de-projet").phrase).toBe("Rien n'a échoué, patientez.");
  });

  it("messageDePause et pauseAttendWilliams", async () => {
    const { messageDePause, pauseAttendWilliams } = await import("@/moteurs/montage-tutoriel-outil/vue-roles");
    expect(messageDePause(travail({}, { pause: { code: "TO_X", message: " Bonjour " } }))).toBe("Bonjour");
    expect(messageDePause(travail({}))).toBeNull();
    expect(pauseAttendWilliams(travail({}, { pause: { code: "TO_SCRIPT_A_VALIDER" } }))).toBe(true);
    expect(pauseAttendWilliams(travail({}, { pause: { code: "TO_FILM_A_CAPTURER" } }))).toBe(false);
  });
});
