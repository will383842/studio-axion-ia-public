/**
 * T-EXT-50 · Gabarit G-Flux : lecteur du flux d'automatisation, scénario de maquette, données des écrans, trame.
 * Purs : aucun navigateur, aucun appel, 0 €.
 */
import { DUREE_CIBLE_SEC } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  ACTEURS_FLUX,
  ETATS_PAR_VUE,
  LIBELLE_SCHEMA_MAX,
  VERSION_FLUX,
  VOIX_MAX_MS,
  VOIX_MIN_MS,
  donneesEcransDepuisFlux,
  lireFluxAutomatisation,
  scenarioDepuisFlux,
  trameGFlux,
  type FluxAutomatisation,
} from "@/moteurs/montage-tutoriel-outil/gabarit-flux";
import { ETAPES_MAX } from "@/moteurs/montage-tutoriel-outil/etapes-tutoriel";
import { lireScenarioMaquette } from "@/moteurs/montage-tutoriel-outil/scenario-maquette";

/** Contenus complets du bureau exemple (T-EXT-49), lus dans `demo-data.js` par `node:vm` comme le font les autres tests. */
function contenusComplets(): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any -- données lues dans un contexte vm
  const source = readFileSync(join(process.cwd(), "outils/maquettes-tableaux-de-bord/ecrans-outils/demo-data.js"), "utf8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contexte de node:vm
  const ctx: Record<string, any> = {};
  vm.runInNewContext(source, { window: ctx });
  return JSON.parse(JSON.stringify(ctx.DONNEES_ECRANS.contenus));
}

/** Flux d'exemple « demande de devis » : 7 écrans filmés (avant, déclencheur, 4 étapes, résultat), une étape humaine. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- le flux brut est volontairement abîmé champ par champ
function brut(): Record<string, any> {
  return {
    version: VERSION_FLUX,
    avant: { vue: "boite", etat: "avant", surMot: "déborde" },
    declencheur: { vue: "boite", etat: "nouveau", surMot: "arrive" },
    etapes: [
      { id: "classement", vue: "boite", etat: "etiquete", acteur: "automatisation", libelleSchema: "Classement du message", surMot: "classe" },
      { id: "brouillon", vue: "boite", etat: "brouillon", acteur: "ia", libelleSchema: "Brouillon de réponse", surMot: "brouillon" },
      { id: "validation", vue: "boite", etat: "brouillon", acteur: "humain", libelleSchema: "Vous validez", surMot: "validez" },
      { id: "equipe", vue: "messagerie", etat: "notification", acteur: "automatisation", libelleSchema: "Équipe prévenue", surMot: "équipe" },
    ],
    moments: ["brouillon", "validation"],
    resultat: { vue: "crm", etat: "fiche-remplie", surMot: "fiche" },
    contenus: contenusComplets(),
  };
}

const lire = (b: unknown) => lireFluxAutomatisation(b);
const erreurs = (b: unknown) => {
  const r = lire(b);
  return r.ok ? "" : r.erreurs.join(" | ");
};
const flux = (): FluxAutomatisation => {
  const r = lire(brut());
  if (!r.ok) throw new Error(r.erreurs.join(" | "));
  return r.flux;
};

describe("lireFluxAutomatisation (T-EXT-50)", () => {
  it("le flux d'exemple est valide", () => {
    const r = lire(brut());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.flux.etapes).toHaveLength(4);
      expect(r.flux.etapes.filter((e) => e.acteur === "humain")).toHaveLength(1);
    }
  });

  it("refuse ce qui n'est pas un objet, sans lever", () => {
    for (const v of [null, undefined, 3, "x", []]) expect(lire(v).ok).toBe(false);
  });

  it("refuse une version inconnue et tout champ inconnu", () => {
    expect(erreurs({ ...brut(), version: "flux.v0" })).toMatch(/Version inconnue/);
    expect(erreurs({ ...brut(), surprise: 1 })).toMatch(/champ inconnu « surprise »/);
    const b = brut();
    b.etapes[0].bonus = true;
    expect(erreurs(b)).toMatch(/Étape 1 : champ inconnu « bonus »/);
  });

  it("refuse toute couleur : la charte décide (jamais de vert)", () => {
    const b = brut();
    b.etapes[0].couleur = "vert";
    expect(erreurs(b)).toMatch(/couleurs sont fixées par la charte/);
  });

  it("refuse une vue ou un état hors de la table de T-EXT-49", () => {
    const b = brut();
    b.etapes[0].vue = "cuisine";
    expect(erreurs(b)).toMatch(/vue inconnue/);
    const c = brut();
    c.etapes[0].etat = "confirme";
    expect(erreurs(c)).toMatch(/état « confirme » non permis pour la vue « boite »/);
    const d = brut();
    d.avant.etat = "inconnu";
    expect(erreurs(d)).toMatch(/Avant : état « inconnu »/);
  });

  it("refuse plus de 9 écrans filmés au total", () => {
    const b = brut();
    b.etapes = Array.from({ length: ETAPES_MAX - 2 }, (_, i) => ({ ...b.etapes[0], id: `e-${i}` }));
    b.etapes[0].acteur = "humain";
    b.moments = [];
    expect(erreurs(b)).toMatch(/Trop d'étapes/);
    b.etapes.pop();
    expect(erreurs(b)).not.toMatch(/Trop d'étapes/);
  });

  it("refuse plus de 3 moments et un moment inconnu", () => {
    const b = brut();
    b.moments = ["classement", "brouillon", "validation", "equipe"];
    expect(erreurs(b)).toMatch(/Trop de moments/);
    b.moments = ["fantome"];
    expect(erreurs(b)).toMatch(/ne désigne aucune étape/);
  });

  it("refuse un flux sans étape humaine", () => {
    const b = brut();
    b.etapes[2].acteur = "automatisation";
    expect(erreurs(b)).toBe("Le flux doit montrer où une personne contrôle et décide.");
  });

  it("refuse un envoi au client sans étape humaine après le brouillon", () => {
    const b = brut();
    b.etapes = [
      { id: "brouillon", vue: "boite", etat: "brouillon", acteur: "ia", libelleSchema: "Brouillon de réponse", surMot: "brouillon" },
      { id: "envoi", vue: "boite", etat: "ouvert", acteur: "automatisation", libelleSchema: "Réponse envoyée", surMot: "envoyée" },
      { id: "controle", vue: "crm", etat: "fiche-remplie", acteur: "humain", libelleSchema: "Vous contrôlez", surMot: "contrôlez" },
    ];
    b.moments = [];
    expect(erreurs(b)).toMatch(/envoi au client doit passer par une étape humaine/);
    // Avec l'étape humaine entre le brouillon et l'envoi : accepté.
    const [brouillon, envoi, controle] = b.etapes;
    b.etapes = [brouillon, controle, envoi];
    expect(lire(b).ok).toBe(true);
  });

  it("refuse un libellé de schéma trop long ou manquant (jamais inventé)", () => {
    const b = brut();
    b.etapes[0].libelleSchema = "x".repeat(LIBELLE_SCHEMA_MAX + 1);
    expect(erreurs(b)).toMatch(/dépasse 28 caractères/);
    const c = brut();
    delete c.etapes[0].libelleSchema;
    expect(erreurs(c)).toMatch(/libellé du schéma est obligatoire/);
    const d = brut();
    d.etapes[0].libelleSchema = "x".repeat(LIBELLE_SCHEMA_MAX);
    expect(lire(d).ok).toBe(true);
  });

  it("refuse un flux dont les contenus ne permettent pas de jouer les écrans (la capture planterait)", () => {
    const vide = brut();
    vide.contenus = {};
    expect(erreurs(vide)).toMatch(/vue « boite » est utilisée/);
    const sansCrm = brut();
    delete sansCrm.contenus.crm;
    expect(erreurs(sansCrm)).toMatch(/vue « crm » est utilisée \(Résultat\)/);
    const sansMessagerie = brut();
    delete sansMessagerie.contenus.messagerie;
    expect(erreurs(sansMessagerie)).toMatch(/vue « messagerie »/);
    const ancienExemple = brut();
    ancienExemple.contenus = { boite: { exemple: true } };
    expect(lire(ancienExemple).ok).toBe(false);
    const sansChamps = brut();
    delete sansChamps.contenus.crm.fiche.champs;
    expect(erreurs(sansChamps)).toMatch(/contenus\.crm.*fiche-remplie.*fiche/);
    const sansBrouillon = brut();
    delete sansBrouillon.contenus.boite.brouillon;
    expect(erreurs(sansBrouillon)).toMatch(/contenus\.boite.*brouillon\.texte/);
  });

  it("accepte les contenus complets du bureau exemple", () => {
    const r = lire(brut());
    expect(r.ok, r.ok ? "" : r.erreurs.join(" | ")).toBe(true);
  });

  it("refuse un montant d'argent dans un texte, où qu'il soit", () => {
    const b = brut();
    b.etapes[0].libelleSchema = "Devis à 1 200 €";
    expect(erreurs(b)).toMatch(/Aucun montant d'argent/);
    const c = brut();
    c.contenus.boite.messages[0].objet = "Devis de 500 euros";
    expect(erreurs(c)).toMatch(/Aucun montant d'argent/);
    const d = brut();
    d.contenus.boite.messages[0].objet = "Prix : 40 $";
    expect(erreurs(d)).toMatch(/Aucun montant d'argent/);
  });

  it("refuse des identifiants réservés, doubles ou mal formés, et des contenus qui ne sont pas des données", () => {
    const b = brut();
    b.etapes[0].id = "avant";
    expect(erreurs(b)).toMatch(/réservé/);
    const c = brut();
    c.etapes[1].id = "classement";
    expect(erreurs(c)).toMatch(/en double/);
    const d = brut();
    d.etapes[0].id = "Classé";
    expect(erreurs(d)).toMatch(/minuscules sans accent/);
    const e = brut();
    e.contenus = { f: () => 1 };
    expect(erreurs(e)).toMatch(/« contenus »/);
    const f = brut();
    f.etapes[0].acteur = "robot";
    expect(erreurs(f)).toMatch(/acteur inconnu/);
  });

  it("la table des états copie celle du bureau exemple (T-EXT-49)", () => {
    const source = readFileSync(join(process.cwd(), "outils/maquettes-tableaux-de-bord/ecrans-outils/etats.js"), "utf8");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contexte de node:vm
    const ctx: Record<string, any> = {};
    vm.runInNewContext(source, { window: ctx });
    const vues = ctx.ETATS_ECRANS.vues as Record<string, { etats: string[] }>;
    expect(Object.keys(ETATS_PAR_VUE).sort()).toEqual(Object.keys(vues).sort());
    for (const [vue, v] of Object.entries(vues)) expect([...ETATS_PAR_VUE[vue as keyof typeof ETATS_PAR_VUE]], vue).toEqual(v.etats);
    expect(ctx.ETATS_ECRANS.etapesMax).toBe(ETAPES_MAX);
    expect([...ACTEURS_FLUX]).toEqual(["automatisation", "ia", "humain"]);
  });
});

describe("scenarioDepuisFlux", () => {
  it("est accepté par le lecteur de T-EXT-01, avec les rôles et les ancres du flux", () => {
    const f = flux();
    const s = scenarioDepuisFlux(f);
    const r = lireScenarioMaquette(s);
    expect(r.ok, r.ok ? "" : r.erreurs.join(" | ")).toBe(true);
    expect(s.maquette).toBe("ecrans-outils");
    expect(s.etapes.map((e) => e.id)).toEqual(["avant", "declencheur", "classement", "brouillon", "validation", "equipe", "resultat"]);
    expect(s.etapes.map((e) => e.role)).toEqual(["accroche", "probleme", "parcours", "parcours", "parcours", "parcours", "appel"]);
    expect(s.etapes.map((e) => (e.ancre as { surMot: string }).surMot)).toEqual(["déborde", "arrive", "classe", "brouillon", "validez", "équipe", "fiche"]);
    expect(s.etapes.every((e) => e.annotation === undefined)).toBe(true);
  });
});

describe("donneesEcransDepuisFlux", () => {
  const MOTS_JS = new Set(["window", "DONNEES_ECRANS", "null", "true", "false"]);
  const mots = (t: string) => new Set(t.match(/[\p{L}\p{N}_-]+/gu) ?? []);

  it("évalué dans node:vm : étapes et contenus identiques au flux", () => {
    const f = flux();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contexte de node:vm
    const ctx: Record<string, any> = {};
    ctx.window = ctx;
    vm.runInNewContext(donneesEcransDepuisFlux(f), ctx);
    const d = ctx.DONNEES_ECRANS;
    expect(d.version).toBe(1);
    expect(d.etapes).toEqual([
      { id: "avant", vue: "boite", etat: "avant" },
      { id: "declencheur", vue: "boite", etat: "nouveau" },
      ...f.etapes.map((e) => ({ id: e.id, vue: e.vue, etat: e.etat })),
      { id: "resultat", vue: "crm", etat: "fiche-remplie" },
    ]);
    expect(JSON.parse(JSON.stringify(d.contenus))).toEqual(f.contenus);
  });

  it("aucun mot ajouté : les mots de la sortie sont dans le flux (mots-clés JS exceptés)", () => {
    const f = flux();
    const permis = mots(JSON.stringify(f));
    const ajoutes = [...mots(donneesEcransDepuisFlux(f))].filter((m) => !permis.has(m) && !MOTS_JS.has(m) && !/^\d+$/.test(m));
    expect(ajoutes).toEqual([]);
  });

  it("est déterministe", () => {
    expect(donneesEcransDepuisFlux(flux())).toBe(donneesEcransDepuisFlux(flux()));
  });
});

describe("trameGFlux", () => {
  it("48 s : parts dans les bornes, somme exacte, ordre avant → flux → schéma → gain et fin", () => {
    const r = trameGFlux(48_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.trame;
    expect(t.avantMs).toBeLessThanOrEqual(0.15 * 48_000);
    expect(t.fluxMs).toBeGreaterThanOrEqual(0.5 * 48_000);
    expect(t.schemaMs).toBeGreaterThanOrEqual(5000);
    expect(t.schemaMs).toBeLessThanOrEqual(8000);
    expect(t.schemaMs).toBeLessThanOrEqual(0.2 * 48_000);
    expect(t.gainFinMs).toBeGreaterThan(0);
    expect(t.avantMs + t.fluxMs + t.schemaMs + t.gainFinMs).toBe(48_000);
    expect(t.debuts).toEqual({ avant: 0, flux: t.avantMs, schema: t.avantMs + t.fluxMs, gainFin: t.avantMs + t.fluxMs + t.schemaMs });
  });

  it("les bornes 40 s et 55 s tiennent aussi", () => {
    for (const d of [VOIX_MIN_MS, VOIX_MAX_MS]) {
      const r = trameGFlux(d);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.trame.schemaMs).toBeLessThanOrEqual(0.2 * d);
      expect(r.trame.gainFinMs).toBeGreaterThan(0);
    }
  });

  it("38 s et 57 s : une trame ET une remarque, jamais un refus ; durée illisible : refus", () => {
    const court = trameGFlux(38_000);
    const long = trameGFlux(57_000);
    expect(court.ok).toBe(true);
    expect(long.ok).toBe(true);
    if (!court.ok || !long.ok) return;
    expect(court.remarques.join()).toMatch(/moins de 40 s/);
    expect(long.remarques.join()).toMatch(/plus de 55 s/);
    // mêmes parts qu'à l'intérieur de la cible
    expect(court.trame.avantMs).toBe(Math.round(38_000 * 0.12));
    expect(long.trame.fluxMs).toBe(Math.round(57_000 * 0.55));
    expect(court.trame.avantMs + court.trame.fluxMs + court.trame.schemaMs + court.trame.gainFinMs).toBe(38_000);
    expect(trameGFlux(Number.NaN).ok).toBe(false);
    expect(trameGFlux(0).ok).toBe(false);
    expect(trameGFlux(-1).ok).toBe(false);
  });

  it("dans la cible : aucune remarque", () => {
    for (const d of [VOIX_MIN_MS, 48_000, VOIX_MAX_MS]) {
      const r = trameGFlux(d);
      expect(r.ok ? r.remarques : ["refus"]).toEqual([]);
    }
  });

  it("voix très courte : le schéma qui ne tient pas est signalé par une remarque, sans refus", () => {
    const r = trameGFlux(20_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.remarques.join()).toMatch(/schéma ne tient pas/);
  });

  it("les bornes 40 et 55 s égalent DUREE_CIBLE_SEC × 1000 (seule source, T-EXT-18)", () => {
    expect([VOIX_MIN_MS, VOIX_MAX_MS]).toEqual([DUREE_CIBLE_SEC[0] * 1000, DUREE_CIBLE_SEC[1] * 1000]);
  });
});
