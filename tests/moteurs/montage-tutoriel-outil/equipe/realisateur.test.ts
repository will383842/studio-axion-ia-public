import { describe, expect, it } from "vitest";
import { lireScenarioMaquette } from "@/moteurs/montage-tutoriel-outil/scenario-maquette";
import { calerScenario } from "@/moteurs/montage-tutoriel-outil/calage-scenario";
import { realiser, type EntreeRealisateur } from "@/moteurs/montage-tutoriel-outil/equipe/realisateur";
import type { CarteZones, ZoneCarte } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import type { CahierVideo, IdGabarit } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import type { PhraseChoisie, ScriptChoisi } from "@/moteurs/montage-tutoriel-outil/equipe/scenariste";
import type { FicheValeur } from "@/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";

const zone = (id: string, o: Partial<ZoneCarte> = {}): ZoneCarte => ({
  id,
  nom: id,
  aller: `vue-${id}`,
  cible: `#${id}`,
  zone: { x: 10, y: 10, largeur: 40, hauteur: 30 },
  etat: "maintenant",
  gestes: ["clic", "zoom", "apparition"],
  prouve: "exemple",
  chiffres: [],
  ...o,
});

const carte = (zones: ZoneCarte[]): CarteZones => ({ version: "carte-zones.v1", maquette: "05-stocks", zones, manques: [] });
const ZONES = [zone("avant", { etat: "avant" }), zone("alerte"), zone("liste"), zone("decision")];

const cahier = (g: IdGabarit[], cas: CahierVideo["cas"] = 1): CahierVideo => ({
  version: "cahier-tutoriel.v1",
  entree: "A",
  cas,
  gabarits: g,
  roles: [],
  manques: [],
  scriptsFournis: [],
  fin: "aucune",
  ratios: ["4:5"],
  dureeCibleSec: [40, 55],
  raisons: [],
});

const ph = (texte: string, temps: PhraseChoisie["temps"], zoneId?: string): PhraseChoisie => ({ texte, temps, zoneId, aRevoir: false });

function script(phrases: PhraseChoisie[]): ScriptChoisi {
  return { texte: phrases.map((p) => p.texte).join(" "), phrases, source: "choisi", empreinte: "x" };
}

const SEPT = [
  ph("Vous cherchez vos chiffres partout.", "situation"),
  ph("Vous perdez du temps chaque matin.", "situation"),
  ph("Ici une alerte apparaît toute seule.", "changement", "alerte"),
  ph("Là votre liste se met à jour.", "changement", "liste"),
  ph("Ensuite vous ouvrez le détail.", "changement", "decision"),
  ph("Puis vous décidez en un clic.", "changement", "decision"),
  ph("Votre entreprise gagne en sérénité.", "gain"),
];

const fiche = { moments: [{ id: "m1", zoneId: "alerte", geste: "clic" }] } as unknown as FicheValeur;

function entree(o: Partial<EntreeRealisateur> = {}): EntreeRealisateur {
  return { cahier: cahier(["G-Decision"]), carte: carte(ZONES), fiche, script: script(SEPT), largeur: 1080, hauteur: 1350, ...o };
}

function erreurs(r: ReturnType<typeof realiser>): string {
  return r.ok ? "" : r.erreurs.join(" | ");
}

describe("réalisateur (T-EXT-22)", () => {
  it("G-Décision : une étape par phrase, un geste par phrase, dernière étape « appel », scénario accepté", () => {
    const r = realiser(entree());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.parcours;
    expect(p.scenario.etapes).toHaveLength(7);
    expect(p.gestes.map((g) => g.phraseIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(p.plansDessines).toEqual([]);
    expect(p.scenario.etapes[0]!.role).toBe("accroche");
    expect(p.scenario.etapes[1]!.role).toBe("probleme");
    expect(p.scenario.etapes[6]!.role).toBe("appel");
    expect(lireScenarioMaquette(p.scenario).ok).toBe(true);
    expect(p.gestes[2]!.geste).toBe("zoom");
    expect(p.gestes[2]!.zoom?.facteur).toBeLessThanOrEqual(1.6);
  });

  it("aucune étape n'a d'annotation ni de durée", () => {
    const r = realiser(entree());
    if (!r.ok) throw new Error("attendu ok");
    for (const e of r.parcours.scenario.etapes) {
      expect("annotation" in e).toBe(false);
      expect(JSON.stringify(e)).not.toMatch(/duree|delai/i);
    }
  });

  it("carte sans zone « avant » : les phrases de situation deviennent des plans dessinés", () => {
    const r = realiser(entree({ carte: carte(ZONES.slice(1)) }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parcours.plansDessines.map((x) => [x.phraseIndex, x.montre])).toEqual([[0, "avant-dessine"], [1, "avant-dessine"]]);
    expect(r.parcours.scenario.etapes).toHaveLength(5);
    expect(r.parcours.gestes).toHaveLength(7);
  });

  it("G-Réponse : les phrases sur une zone « message » deviennent des plans conversation", () => {
    const zones = [zone("accueil", { etat: "avant" }), zone("fil", { message: { auteur: "client", ordre: 0 } }), zone("reponse", { message: { auteur: "assistant", ordre: 1 } }), zone("fiche")];
    const s = script([
      ph("Un client écrit à deux heures du matin.", "situation"),
      ph("Il pose sa question sans attendre.", "changement", "fil"),
      ph("La réponse arrive tout de suite.", "changement", "reponse"),
      ph("Vous retrouvez la demande classée.", "changement", "fiche"),
      ph("Votre entreprise ne rate plus rien.", "gain"),
    ]);
    const r = realiser(entree({ cahier: cahier(["G-Reponse"], 4), carte: carte(zones), script: s }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parcours.plansDessines.map((x) => [x.phraseIndex, x.montre])).toEqual([[0, "avant-dessine"], [1, "conversation"], [2, "conversation"]]);
    expect(r.parcours.scenario.etapes.map((e) => e.role)).toEqual(["parcours", "appel"]);
  });

  it("zone de 10 % refusée (trop petite), 20 % acceptée (20 × 1,6 = 32 %), x = 95 sur 10 de large hors champ", () => {
    const avec = (z: ZoneCarte["zone"]) => realiser(entree({ carte: carte([ZONES[0]!, zone("alerte", { zone: z }), ...ZONES.slice(2)]) }));
    expect(erreurs(avec({ x: 10, y: 10, largeur: 10, hauteur: 30 }))).toMatch(/trop petite pour être lisible/);
    expect(avec({ x: 10, y: 10, largeur: 20, hauteur: 30 }).ok).toBe(true);
    expect(erreurs(avec({ x: 95, y: 10, largeur: 10, hauteur: 30 }))).toMatch(/hors champ/);
    expect(erreurs(avec({ x: 10, y: 10, largeur: 0, hauteur: 30 }))).toMatch(/hors champ/);
  });

  it("zone qui n'a que « survol » dans un segment qui ne le permet pas : refus nommé", () => {
    const zones = [ZONES[0]!, zone("alerte", { gestes: ["survol"] }), ...ZONES.slice(2)];
    const r = realiser(entree({ cahier: cahier(["G-Journee"]), carte: carte(zones) }));
    expect(erreurs(r)).toMatch(/Phrase 3 : aucun geste permis sur la zone alerte/);
  });

  it("deux phrases qui commencent par « Vous » : ancres sur le premier mot plein, occurrences distinctes", () => {
    const r = realiser(entree());
    if (!r.ok) throw new Error("attendu ok");
    const [a, b] = r.parcours.scenario.etapes;
    expect(a!.ancre).toEqual({ surMot: "vous", occurrence: 1 });
    expect(b!.ancre).toEqual({ surMot: "vous", occurrence: 2 });
  });

  it("mots élidés (« L'alerte », « Aujourd'hui ») : ancres sur mots entiers, scénario calable sur une voix découpée aux espaces", () => {
    const phrases = [
      ph("L'alerte arrive chaque matin.", "situation"),
      ph("Aujourd'hui votre liste se met à jour.", "situation"),
      ph("L'alerte apparaît toute seule.", "changement", "alerte"),
      ph("Là votre liste change.", "changement", "liste"),
      ph("Votre entreprise gagne en sérénité.", "gain"),
    ];
    const r = realiser(entree({ script: script(phrases) }));
    if (!r.ok) throw new Error(`attendu ok : ${r.erreurs.join(" ")}`);
    const ancres = r.parcours.scenario.etapes.map((e) => ("surMot" in e.ancre ? e.ancre : null));
    expect(ancres[0]).toEqual({ surMot: "l'alerte", occurrence: 1 });
    expect(ancres[1]).toEqual({ surMot: "aujourd'hui", occurrence: 1 });
    expect(ancres[2]).toEqual({ surMot: "l'alerte", occurrence: 2 });
    const mots = script(phrases).texte.split(/\s+/).map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
    const c = calerScenario(r.parcours.scenario, mots, 60_000);
    expect(c.ok).toBe(true);
  });

  it("11 phrases de changement : refus « 9 étapes filmées au plus »", () => {
    const longues = Array.from({ length: 11 }, (_, i) => ph(`Etape ${i} numéro ${i} se montre.`, "changement", "alerte"));
    const s = script([SEPT[0]!, ...longues, SEPT[6]!]);
    expect(erreurs(realiser(entree({ script: s })))).toMatch(/9 étapes filmées au plus/);
  });

  it("G-Flux (cahier direct ou cas 5) : plus refusé pour « pas encore disponible »", () => {
    expect(erreurs(realiser(entree({ cahier: cahier(["G-Flux"]) })))).not.toMatch(/pas encore disponible/);
    expect(erreurs(realiser(entree({ cahier: cahier(["G-Flux", "G-Decision"], 5) })))).not.toMatch(/pas encore disponible/);
  });

  it("gabarit qui ne sert pas le cas : refus", () => {
    expect(erreurs(realiser(entree({ cahier: cahier(["G-Reponse"], 1) })))).toMatch(/ne sert pas le cas 1/);
  });

  it("phrase de changement sans zone : refus nommé ; temps absent repris de la phrase précédente", () => {
    const s = script([SEPT[0]!, { texte: "Cela change tout ici.", aRevoir: true, temps: "changement" }, SEPT[6]!]);
    expect(erreurs(realiser(entree({ script: s })))).toMatch(/Phrase 2 : aucune zone indiquée/);
  });

  it("ne lève jamais sur une entrée cassée", () => {
    const r = realiser({} as unknown as EntreeRealisateur);
    expect(r.ok).toBe(false);
  });

  it("même entrée deux fois : même empreinte ; une phrase changée : empreinte différente", () => {
    const a = realiser(entree());
    const b = realiser(entree());
    if (!a.ok || !b.ok) throw new Error("attendu ok");
    expect(a.parcours.empreinte).toBe(b.parcours.empreinte);
    const autre = realiser(entree({ script: script([...SEPT.slice(0, 6), ph("Enfin votre entreprise respire.", "gain")]) }));
    if (!autre.ok) throw new Error("attendu ok");
    expect(autre.parcours.empreinte).not.toBe(a.parcours.empreinte);
  });
});
