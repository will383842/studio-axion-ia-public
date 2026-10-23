/**
 * Fins du format « appel au diagnostic » (C2, puis X6 le 12/10/2026 : une seule demande par fin) : table à part, jamais
 * mêlée à TABLE_FINS ; validation tracée ; anciennes lignes désactivées avec leur motif ; suite de fins.
 */
import { describe, expect, it } from "vitest";
import { appelDeLaBanque, ErreurFin, finPour, nombreMots, suiteDeFins, TABLE_FINS, TABLE_FINS_DIAGNOSTIC } from "../../../src/briques/fins";
import { MOTIF_REMPLACEE, MOTIF_RESERVEZ_NON_REPRIS, VALIDATION_USINE, VALIDATION_WILL_ABONNEMENT, VALIDATION_WILL_RESERVEZ, VALIDATION_WILL_SECOURS, VALIDATION_WILL_SECOURS_2, VALIDATION_WILL_SECOURS_IG } from "../../../src/briques/fins/banque";
import { MOTS_DIT_MAX, MOTS_ECRAN_MAX } from "../../../src/briques/fins/types";
import { appelsValides } from "../../../src/services/tableau-fin";

/** Dictée de Will (11/10/2026) puis fin de la vidéo de référence validée (tests/cas-concret/temoin/reference/texte.txt). */
const DICTEE = "Écrivez IA en commentaire : on vous envoie toute la structure de cette automatisation, à mettre en place chez vous. Ou réservez votre diagnostic gratuit, lien en premier commentaire ou dans la bio.";
const VIDEO = "Écrivez I.A. en commentaire on vous envoie toute la structure de cette automatisation, à mettre en place chez vous. Ou réservez votre diagnostic gratuit. Le lien vous attend en premier commentaire.";

const norme = (t: string): string => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
const CORPUS = norme(`${DICTEE} ${VIDEO}`);

/** Validées par Will le 11/10/2026 (dictée, vidéo de référence), toujours en service. */
const VALIDEES_WILL = ["fin-if-mot", "fin-if-cadeau-automatisation", "fin-if-cadeau-suite"];
/** Proposées par l'Usine sur délégation de Will (12/10/2026), utilisables par le format. */
const PROPOSEES = [
  "fin-if-diagnostic-gratuit", "fin-ty-diagnostic-gratuit", "fin-li-diagnostic-gratuit",
  "fin-ig-lien-profil", "fin-tt-lien-profil", "fin-fb-lien-commentaire", "fin-li-lien-commentaire", "fin-if-envoi-structure",
];
/** Validée par Will le 12/10/2026 (X7) : la fin au mot d'Instagram, abonnement compris. */
const ABONNEMENT = "fin-ig-mot-abonnement";
/** Remplacées le 12/10/2026 : gardées, désactivées. */
const REMPLACEES = ["fin-fb-lien", "fin-li-lien", "fin-ig-lien", "fin-tt-lien"];
/** « Réservez votre diagnostic gratuit. » réactivée le 14/10 (OUI de Will du 12/10). */
const RESERVEZ = ["fin-if-rdv-seul", "fin-ty-rdv"];
/** Fin de secours de Facebook, validée par Will le 15/10/2026 (v-dd3049053f88) : choisie seulement par son identifiant. */
const SECOURS = "fin-fb-lien-premier-commentaire";
/** 2ᵉ fin de secours de Facebook, validée par Will le 15/10/2026 (« OK fais ce qui est nécessaire ») : par identifiant seulement. */
const SECOURS_2 = "fin-fb-lien-sous-video";
/** Fin de secours d'Instagram et de YouTube Shorts, variante B validée par Will le 19/10/2026 (v-6a3b74364711) : par identifiant seulement. */
const SECOURS_IG = "fin-ig-lien-profil-secours";
const SECOURS_YS = "fin-ys-lien-profil-secours";
const PHRASE_SECOURS_IG = "Vous trouverez le lien juste en haut de mon profil.";
/** Restées désactivées : seconde demande (« Ou réservez… ») et LinkedIn (rien n'y est dit). */
const RESERVEZ_COUPEES = ["fin-if-rdv", "fin-li-rdv"];
const NON_VALIDEES = ["fin-if-cadeau-integration", "fin-if-cadeau-formation", "fin-if-cadeau-audit", ...REMPLACEES, ...RESERVEZ_COUPEES];
const DIAGNOSTIC = "Faites votre diagnostic gratuit en quelques minutes.";

describe("TABLE_FINS : jamais mêlée à la table du diagnostic", () => {
  // La table commune appartient au tableau animé, qui y ajoute ses fins : ce test ne fige ni sa taille ni son contenu.
  it("aucun identifiant du diagnostic n'est dans TABLE_FINS ; seules les fins de TikTok, Shorts et YouTube portent des réseaux (12/10)", () => {
    const ids = new Set(TABLE_FINS.map((f) => f.id));
    for (const f of TABLE_FINS_DIAGNOSTIC) expect(ids.has(f.id), f.id).toBe(false);
    for (const f of TABLE_FINS.filter((x) => x.id !== "fin-ty-mot-envoi" && x.id !== "fin-ty-lien-profil")) expect(f).not.toHaveProperty("reseaux");
    expect(TABLE_FINS.find((f) => f.id === "fin-ty-mot-envoi")?.reseaux).toEqual(["youtube"]);
    expect(TABLE_FINS.find((f) => f.id === "fin-ty-lien-profil")?.reseaux).toEqual(["tiktok", "youtube-shorts"]);
  });

  it("le tableau animé ne voit aucune fin du diagnostic", () => {
    const diagnostic = new Set(TABLE_FINS_DIAGNOSTIC.map((f) => f.id));
    for (const reseau of ["facebook", "instagram", "tiktok", "linkedin"] as const) {
      for (const f of appelsValides(reseau)) expect(diagnostic.has(f.id), f.id).toBe(false);
    }
    expect(() => finPour("facebook", "fin-if-mot", { mot: "IA" })).toThrow(/Aucune fin « fin-if-mot »/);
  });
});

describe("TABLE_FINS_DIAGNOSTIC", () => {
  it("27 lignes, identifiants uniques, table gelée", () => {
    expect(TABLE_FINS_DIAGNOSTIC).toHaveLength(27);
    expect(new Set(TABLE_FINS_DIAGNOSTIC.map((f) => f.id)).size).toBe(27);
    expect(Object.isFrozen(TABLE_FINS_DIAGNOSTIC)).toBe(true);
    for (const f of TABLE_FINS_DIAGNOSTIC) expect(Object.isFrozen(f), f.id).toBe(true);
  });

  it("dix-huit lignes utilisables (dont les quatre fins de secours), neuf non (trois cadeaux transposés, quatre remplacées, deux « Réservez » coupées)", () => {
    expect(TABLE_FINS_DIAGNOSTIC.filter((f) => f.validee).map((f) => f.id).sort()).toEqual([...VALIDEES_WILL, ...PROPOSEES, ABONNEMENT, ...RESERVEZ, SECOURS, SECOURS_2, SECOURS_IG, SECOURS_YS].sort());
    expect(TABLE_FINS_DIAGNOSTIC.filter((f) => !f.validee).map((f) => f.id).sort()).toEqual([...NON_VALIDEES].sort());
    for (const f of TABLE_FINS_DIAGNOSTIC.filter((x) => !x.validee)) expect(f.validation, f.id).toBeUndefined();
  });

  it("les lignes validées par Will gardent leur trace, et leur phrase dite figure dans la dictée ou la vidéo", () => {
    for (const f of TABLE_FINS_DIAGNOSTIC.filter((x) => VALIDEES_WILL.includes(x.id))) {
      expect(f.validation, f.id).toEqual({ par: "will", le: "2026-10-11", source: "dictée de Will et vidéo de référence v10" });
      expect(CORPUS, f.id).toContain(norme(f.dit.replace("{MOT}", "IA")));
    }
  });

  it("les propositions de l'Usine portent leur trace : « proposée par l'Usine sur délégation de Will, 12/10/2026 »", () => {
    expect(VALIDATION_USINE).toEqual({ par: "will", le: "2026-10-12", source: "proposée par l'Usine sur délégation de Will, 12/10/2026" });
    for (const id of PROPOSEES) expect(TABLE_FINS_DIAGNOSTIC.find((f) => f.id === id)?.validation, id).toEqual(VALIDATION_USINE);
  });

  it("les anciennes lignes ne sont pas supprimées : désactivées, avec le motif « remplacée le 12/10/2026 »", () => {
    expect(MOTIF_REMPLACEE).toBe("remplacée le 12/10/2026");
    for (const id of REMPLACEES) expect(TABLE_FINS_DIAGNOSTIC.find((f) => f.id === id), id).toMatchObject({ validee: false, motif: MOTIF_REMPLACEE });
    for (const id of RESERVEZ_COUPEES) expect(TABLE_FINS_DIAGNOSTIC.find((f) => f.id === id), id).toMatchObject({ validee: false, motif: MOTIF_RESERVEZ_NON_REPRIS });
    for (const f of TABLE_FINS_DIAGNOSTIC.filter((x) => !REMPLACEES.includes(x.id) && !RESERVEZ_COUPEES.includes(x.id))) expect(f, f.id).not.toHaveProperty("motif");
    for (const id of [...REMPLACEES, ...RESERVEZ_COUPEES]) expect(() => suiteDeFins(id.startsWith("fin-ty") || id === "fin-tt-lien" ? "tiktok" : id.startsWith("fin-li") ? "linkedin" : id === "fin-ig-lien" ? "instagram" : "facebook", [id], {}, TABLE_FINS_DIAGNOSTIC), id).toThrow(/pas encore validée/);
  });

  it("aucune ligne utilisable ne dit « rendez-vous », « bio » ni deux demandes ; « réservez » seulement dans les deux lignes réactivées", () => {
    for (const f of TABLE_FINS_DIAGNOSTIC.filter((x) => x.validee)) {
      expect(`${f.dit} ${f.ecran}`, f.id).not.toMatch(/rendez-vous|\bbio\b|^ou\s/i);
      if (!RESERVEZ.includes(f.id)) expect(`${f.dit} ${f.ecran}`, f.id).not.toMatch(/r[ée]servez/i);
    }
  });

  it("« Réservez votre diagnostic gratuit. » réactivée (OUI de Will du 12/10), mot pour mot comme la base 7, avec sa trace", () => {
    for (const id of RESERVEZ) {
      const f = TABLE_FINS_DIAGNOSTIC.find((x) => x.id === id)!;
      expect(f, id).toMatchObject({ validee: true, dit: "Réservez votre diagnostic gratuit.", ecran: "Réservez votre diagnostic gratuit", validation: VALIDATION_WILL_RESERVEZ });
    }
    expect(suiteDeFins("instagram", ["fin-if-rdv-seul"], {}, TABLE_FINS_DIAGNOSTIC)[0]?.dit).toBe("Réservez votre diagnostic gratuit.");
    expect(suiteDeFins("tiktok", ["fin-ty-rdv"], {}, TABLE_FINS_DIAGNOSTIC)[0]?.dit).toBe("Réservez votre diagnostic gratuit.");
  });

  it("chaque ligne tient 12 mots dits et 8 écrits", () => {
    for (const f of TABLE_FINS_DIAGNOSTIC) {
      expect(nombreMots(f.dit), f.id).toBeLessThanOrEqual(MOTS_DIT_MAX);
      expect(nombreMots(f.ecran), f.id).toBeLessThanOrEqual(MOTS_ECRAN_MAX);
    }
  });
});

describe("fin de secours de Facebook (15/10/2026, v-dd3049053f88)", () => {
  it("validée par Will, marquée de secours, seule avec la 2ᵉ ; limitée à Facebook ; ajoutée avant la 2ᵉ", () => {
    const f = TABLE_FINS_DIAGNOSTIC.find((x) => x.id === SECOURS)!;
    expect(f).toMatchObject({ groupe: "instagram-facebook", type: "lien", dit: "Le lien est dans le premier commentaire.", ecran: "Diagnostic gratuit · lien en premier commentaire", reseaux: ["facebook"], validee: true, secours: true, validation: VALIDATION_WILL_SECOURS });
    expect(VALIDATION_WILL_SECOURS).toMatchObject({ par: "will", le: "2026-10-15" });
    expect(TABLE_FINS_DIAGNOSTIC.filter((x) => x.secours).map((x) => x.id)).toEqual([SECOURS, SECOURS_2, SECOURS_IG, SECOURS_YS]);
    expect(TABLE_FINS_DIAGNOSTIC.at(-4)?.id).toBe(SECOURS);
    expect(suiteDeFins("facebook", ["fin-if-diagnostic-gratuit", SECOURS], {}, TABLE_FINS_DIAGNOSTIC).map((x) => x.dit)).toEqual(["Faites votre diagnostic gratuit en quelques minutes.", "Le lien est dans le premier commentaire."]);
    expect(() => suiteDeFins("instagram", [SECOURS], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(/prévue pour facebook/);
  });
});

describe("2ᵉ fin de secours de Facebook (15/10/2026, v-dd3049053f88, trav-f2b26bba35ac)", () => {
  it("validée par Will, marquée de secours, sans le mot « commentaire » ; limitée à Facebook ; ajoutée en dernier", () => {
    const f = TABLE_FINS_DIAGNOSTIC.find((x) => x.id === SECOURS_2)!;
    expect(f).toMatchObject({ groupe: "instagram-facebook", type: "lien", dit: "Le lien est juste sous la vidéo.", ecran: "Diagnostic gratuit · lien juste sous la vidéo", reseaux: ["facebook"], validee: true, secours: true, validation: VALIDATION_WILL_SECOURS_2 });
    expect(VALIDATION_WILL_SECOURS_2).toMatchObject({ par: "will", le: "2026-10-15" });
    expect(f.dit).not.toMatch(/commentaire/i);
    expect(TABLE_FINS_DIAGNOSTIC.at(-3)?.id).toBe(SECOURS_2);
    expect(suiteDeFins("facebook", ["fin-if-diagnostic-gratuit", SECOURS_2], {}, TABLE_FINS_DIAGNOSTIC).map((x) => x.dit)).toEqual(["Faites votre diagnostic gratuit en quelques minutes.", "Le lien est juste sous la vidéo."]);
    expect(() => suiteDeFins("instagram", [SECOURS_2], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(/prévue pour facebook/);
  });
});

describe("fin de secours d'Instagram et de Shorts (19/10/2026, v-6a3b74364711)", () => {
  it("variante B de Will, mot pour mot ; écran identique à la fin normale ; limitée à son réseau ; ajoutée en dernier ; sans « commentaire », « Instagram » ni « bio »", () => {
    const f = TABLE_FINS_DIAGNOSTIC.find((x) => x.id === SECOURS_IG)!;
    expect(f).toMatchObject({ groupe: "instagram-facebook", type: "lien", dit: PHRASE_SECOURS_IG, reseaux: ["instagram"], validee: true, secours: true, validation: VALIDATION_WILL_SECOURS_IG });
    expect(f.ecran).toBe(TABLE_FINS_DIAGNOSTIC.find((x) => x.id === "fin-ig-lien-profil")!.ecran);
    const y = TABLE_FINS_DIAGNOSTIC.find((x) => x.id === SECOURS_YS)!;
    expect(y).toMatchObject({ groupe: "tiktok-youtube", type: "lien", dit: PHRASE_SECOURS_IG, reseaux: ["youtube-shorts"], validee: true, secours: true, validation: VALIDATION_WILL_SECOURS_IG });
    expect(y.ecran).toBe(appelDeLaBanque("fin-ty-lien-profil")!.ecran);
    expect(VALIDATION_WILL_SECOURS_IG).toMatchObject({ par: "will", le: "2026-10-19" });
    expect(TABLE_FINS_DIAGNOSTIC.at(-2)?.id).toBe(SECOURS_IG);
    expect(TABLE_FINS_DIAGNOSTIC.at(-1)?.id).toBe(SECOURS_YS);
    expect(nombreMots(f.dit)).toBe(10);
    for (const x of [f, y]) expect(`${x.dit} ${x.ecran}`).not.toMatch(/commentaire|instagram|bio/i);
    // Jamais dans la base 7 : sinon un test exigerait le même texte que la banque.
    expect(appelDeLaBanque(SECOURS_IG)).toBeNull();
    expect(appelDeLaBanque(SECOURS_YS)).toBeNull();
  });

  it("choisie par son identifiant, sur son réseau seulement ; Facebook ne peut pas la prendre", () => {
    expect(suiteDeFins("instagram", ["fin-if-diagnostic-gratuit", SECOURS_IG], {}, TABLE_FINS_DIAGNOSTIC).map((x) => x.dit)).toEqual([DIAGNOSTIC, PHRASE_SECOURS_IG]);
    expect(suiteDeFins("youtube-shorts", ["fin-ty-diagnostic-gratuit", SECOURS_YS], {}, TABLE_FINS_DIAGNOSTIC).map((x) => x.dit)).toEqual([DIAGNOSTIC, PHRASE_SECOURS_IG]);
    expect(() => suiteDeFins("facebook", [SECOURS_IG], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(ErreurFin);
    expect(() => suiteDeFins("instagram", [SECOURS_YS], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(ErreurFin);
    expect(() => suiteDeFins("tiktok", [SECOURS_YS], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(/prévue pour youtube-shorts/);
  });
});

describe("limite par réseau", () => {
  it("le lien de chaque réseau est refusé ailleurs", () => {
    expect(() => suiteDeFins("facebook", ["fin-ig-lien-profil"], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(ErreurFin);
    expect(() => suiteDeFins("instagram", ["fin-fb-lien-commentaire"], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(/prévue pour facebook/);
    expect(suiteDeFins("instagram", ["fin-ig-lien-profil"], {}, TABLE_FINS_DIAGNOSTIC)[0]?.ecran).toBe("Diagnostic gratuit · lien dans le profil");
    expect(() => suiteDeFins("youtube", ["fin-tt-lien-profil"], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(ErreurFin);
  });
});

describe("fins par réseau du 12/10/2026 (une seule demande)", () => {
  const dits = (reseau: Parameters<typeof suiteDeFins>[0], ids: string[], mot?: string) => suiteDeFins(reseau, ids, mot ? { mot } : {}, TABLE_FINS_DIAGNOSTIC);

  it("Instagram et TikTok : diagnostic puis « Le lien est dans mon profil. » ; même écran", () => {
    const ig = dits("instagram", ["fin-if-diagnostic-gratuit", "fin-ig-lien-profil"]);
    const tt = dits("tiktok", ["fin-ty-diagnostic-gratuit", "fin-tt-lien-profil"]);
    expect(ig.map((f) => f.dit)).toEqual([DIAGNOSTIC, "Le lien est dans mon profil."]);
    expect(tt.map((f) => [f.dit, f.ecran])).toEqual(ig.map((f) => [f.dit, f.ecran]));
    expect(ig[1].ecran).toBe("Diagnostic gratuit · lien dans le profil");
  });

  it("Facebook : « Le lien est en commentaire. » ; LinkedIn : « Le lien est en premier commentaire. » ; même écran", () => {
    const fb = dits("facebook", ["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"]);
    const li = dits("linkedin", ["fin-li-diagnostic-gratuit", "fin-li-lien-commentaire"]);
    expect(fb.map((f) => f.dit)).toEqual([DIAGNOSTIC, "Le lien est en commentaire."]);
    expect(li.map((f) => f.dit)).toEqual([DIAGNOSTIC, "Le lien est en premier commentaire."]);
    expect(fb[1].ecran).toBe("Diagnostic gratuit · lien en commentaire");
    expect(li[1].ecran).toBe(fb[1].ecran);
  });

  it("au mot (Instagram, Facebook) : « Écrivez IA en commentaire. » puis « Je vous envoie la structure complète. »", () => {
    for (const reseau of ["instagram", "facebook"] as const) {
      const f = dits(reseau, ["fin-if-mot", "fin-if-envoi-structure"], "IA");
      expect(f.map((x) => x.dit)).toEqual(["Écrivez IA en commentaire.", "Je vous envoie la structure complète."]);
      expect(f[0].ecran).toBe("Écrivez IA en commentaire");
    }
  });
});

describe("X7 · fin au mot d'Instagram, décision de Will du 12/10/2026 : l'abonnement est obligatoire", () => {
  it("la phrase validée, mot pour mot, en une seule ligne (10 mots dits, sous la règle des 12)", () => {
    const [f] = suiteDeFins("instagram", [ABONNEMENT], { mot: "IA" }, TABLE_FINS_DIAGNOSTIC);
    expect(f).toEqual({ id: ABONNEMENT, groupe: "instagram-facebook", type: "commentaire", dit: "Abonnez-vous et écrivez IA en commentaire : je vous l'envoie.", ecran: "Abonnez-vous et écrivez IA en commentaire" });
    expect(nombreMots(f.dit)).toBe(10);
    // Un mot est toujours d'un seul tenant (2 à 24 lettres ou chiffres) : la phrase ne dépasse jamais 12 mots.
    const [long] = suiteDeFins("instagram", [ABONNEMENT], { mot: "ABCDEFGHIJKLMNOPQRSTUVWX" }, TABLE_FINS_DIAGNOSTIC);
    expect(nombreMots(long.dit)).toBeLessThanOrEqual(MOTS_DIT_MAX);
    expect(nombreMots(long.ecran)).toBeLessThanOrEqual(MOTS_ECRAN_MAX);
  });

  it("validée par Will, avec sa trace ; réservée à Instagram", () => {
    expect(TABLE_FINS_DIAGNOSTIC.find((f) => f.id === ABONNEMENT)).toMatchObject({ validee: true, reseaux: ["instagram"], validation: VALIDATION_WILL_ABONNEMENT });
    expect(VALIDATION_WILL_ABONNEMENT).toEqual({ par: "will", le: "2026-10-12", source: "validée par Will le 12/10/2026 (code de l'Usine fin-ig-mot-abonnement)" });
    expect(() => suiteDeFins("facebook", [ABONNEMENT], { mot: "IA" }, TABLE_FINS_DIAGNOSTIC)).toThrow(/prévue pour instagram/);
    expect(() => suiteDeFins("linkedin", [ABONNEMENT], { mot: "IA" }, TABLE_FINS_DIAGNOSTIC)).toThrow(ErreurFin);
  });

  it("Facebook garde « Écrivez IA en commentaire. » sans condition d'abonnement ; aucune fin de LinkedIn n'appelle à commenter", () => {
    expect(suiteDeFins("facebook", ["fin-if-mot"], { mot: "IA" }, TABLE_FINS_DIAGNOSTIC)[0].dit).toBe("Écrivez IA en commentaire.");
    for (const f of TABLE_FINS_DIAGNOSTIC.filter((x) => x.groupe === "linkedin" && x.validee)) expect(f.type, f.id).not.toBe("commentaire");
  });
});

describe("suiteDeFins", () => {
  it("rend l'ordre demandé", () => {
    const suite = suiteDeFins("facebook", ["fin-if-mot", "fin-if-cadeau-automatisation", "fin-if-cadeau-suite", "fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"], { mot: "IA" }, TABLE_FINS_DIAGNOSTIC);
    expect(suite.map((f) => f.id)).toEqual(["fin-if-mot", "fin-if-cadeau-automatisation", "fin-if-cadeau-suite", "fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"]);
    const inverse = suiteDeFins("linkedin", ["fin-li-lien-commentaire", "fin-li-diagnostic-gratuit"], {}, TABLE_FINS_DIAGNOSTIC);
    expect(inverse.map((f) => f.id)).toEqual(["fin-li-lien-commentaire", "fin-li-diagnostic-gratuit"]);
  });

  it("lève ErreurFin à la première ligne non validée", () => {
    expect(() => suiteDeFins("instagram", ["fin-if-diagnostic-gratuit", "fin-if-cadeau-audit", "fin-if-cadeau-formation"], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(/Un exemple de plan d'audit/);
    expect(() => suiteDeFins("instagram", ["fin-if-cadeau-integration"], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(/pas encore validée par Will/);
  });

  it("refuse un identifiant absent de la table fournie", () => {
    expect(() => suiteDeFins("linkedin", ["fin-inconnue"], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(ErreurFin);
  });

  it("motDit : le dit lit « I.A. », l'écran garde « IA »", () => {
    const [f] = suiteDeFins("instagram", ["fin-if-mot"], { mot: "IA", motDit: "I.A." }, TABLE_FINS_DIAGNOSTIC);
    expect(f?.dit).toBe("Écrivez I.A. en commentaire.");
    expect(f?.ecran).toBe("Écrivez IA en commentaire");
    const [g] = suiteDeFins("instagram", ["fin-if-mot"], { mot: "IA" }, TABLE_FINS_DIAGNOSTIC);
    expect(g?.dit).toBe("Écrivez IA en commentaire.");
  });

  it("le mot reste exigé (2 à 24 lettres ou chiffres)", () => {
    expect(() => suiteDeFins("instagram", ["fin-if-mot"], {}, TABLE_FINS_DIAGNOSTIC)).toThrow(/mot à commenter/);
  });
});
