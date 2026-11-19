/** T-EXT-V2-02 : pièces déduites d'une maquette créée (pur, sans IA, aucun appel, aucun navigateur, aucun rendu, 0 €). */
import { describe, expect, it } from "vitest";
import { garderChiffres } from "@/briques/donnees-video/garde-chiffres";
import { lireTableauDeBord } from "@/briques/donnees-video/types";
import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { schemaCarteZones } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import {
  carteDepuisDescription,
  controlerTextesCrees,
  empreinteDescription,
  entreePhraseActive,
  lireApercu,
  PARAM_ENTREE_PHRASE,
  PARAM_PIECE_CLAUDE,
  pieceCreeeClaudeActive,
  PROPOSITIONS_PIECE_MAX,
  scenarioApercu,
  tableauDepuisDescription,
  textesDeLaMaquette,
  VERSION_APERCU,
} from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { lireScenarioMaquette } from "@/moteurs/montage-tutoriel-outil/scenario-maquette";

const brute = () => ({
  version: "description-maquette.v1",
  nom: "Espace démo · Atelier",
  entreprise: "Entreprise exemple",
  metier: "Atelier",
  ecrans: [
    {
      id: "accueil",
      modele: "tableau-de-bord",
      titre: "Vue du jour",
      zones: [
        {
          id: "commandes",
          type: "kpi",
          libelle: "Commandes prêtes",
          donnees: [
            { id: "prets-avant", libelle: "Prêtes", valeur: 4, exemple: true, etat: "avant" },
            { id: "prets-apres", libelle: "Prêtes", valeur: 12, exemple: true, etat: "maintenant" },
          ],
        },
        {
          id: "retards",
          type: "liste",
          libelle: "Retards à suivre",
          donnees: [{ id: "retard-a", libelle: "Table chêne", valeur: "En attente" }],
        },
        {
          id: "semaine",
          type: "graphique",
          libelle: "Semaine",
          donnees: [
            { id: "lundi", libelle: "Lundi", valeur: 3, exemple: true },
            { id: "mardi", libelle: "Mardi", valeur: 5, exemple: true },
          ],
        },
      ],
    },
    {
      id: "fiche-client",
      modele: "tableau-de-bord",
      titre: "Fiche",
      zones: [{ id: "fiche", type: "fiche", libelle: "Fiche commande", donnees: [{ id: "ref", libelle: "Référence", valeur: "Lot ouvert" }] }],
    },
  ],
  etats: { avant: "Papiers et appels", maintenant: "Tout est à l'écran" },
});

function decrire(o: unknown = brute()): DescriptionMaquette {
  const r = lireDescriptionMaquette(o, { interdits: [] });
  if (!r.ok) throw new Error(r.erreurs.join(" | "));
  return r.description;
}

/** Description valide (le lecteur n'impose pas ces règles), avec un seul texte modifié. */
function avecTitre(titre: string): DescriptionMaquette {
  const d = decrire();
  return { ...d, ecrans: [{ ...d.ecrans[0]!, titre }, d.ecrans[1]!] };
}
const refus = (titre: string, nomsPermis: string[] = []) => controlerTextesCrees(avecTitre(titre), nomsPermis).filter((e) => e.includes(`« ${titre} »`));

describe("réglages et bornes", () => {
  it("clés et bornes fixes", () => {
    expect(PARAM_ENTREE_PHRASE).toBe("tutoriel.entreePhrase");
    expect(PARAM_PIECE_CLAUDE).toBe("tutoriel.pieceCreeeClaude");
    expect(PROPOSITIONS_PIECE_MAX).toBe(2);
    expect(VERSION_APERCU).toBe("apercu-piece.v1");
  });

  it("éteint par défaut : seul `true` exact allume, rien n'est écrit", async () => {
    const lus: string[] = [];
    const lecteur = (valeur: unknown) => (async <T>(id: string, defaut: T) => (lus.push(id), (id === PARAM_ENTREE_PHRASE || id === PARAM_PIECE_CLAUDE ? valeur : defaut) as T)) as <T>(id: string, defaut: T) => Promise<T>;
    expect(await entreePhraseActive()).toBe(false);
    expect(await pieceCreeeClaudeActive()).toBe(false);
    for (const v of [undefined, false, "true", 1, null, "oui"]) {
      expect(await entreePhraseActive(lecteur(v))).toBe(false);
      expect(await pieceCreeeClaudeActive(lecteur(v))).toBe(false);
    }
    expect(await entreePhraseActive(lecteur(true))).toBe(true);
    expect(await pieceCreeeClaudeActive(lecteur(true))).toBe(true);
    expect(lus).toContain(PARAM_PIECE_CLAUDE);
    expect(await pieceCreeeClaudeActive((async () => { throw new Error("panne"); }) as never)).toBe(false);
  });
});

describe("carteDepuisDescription", () => {
  it("une zone de carte par zone décrite, relue par le schéma", () => {
    const r = carteDepuisDescription(decrire());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(schemaCarteZones.safeParse(r.carte).success).toBe(true);
    expect(r.carte.zones).toHaveLength(4);
    expect(r.carte.zones.map((z) => z.cible)).toEqual(['[data-zone="commandes"]', '[data-zone="retards"]', '[data-zone="semaine"]', '[data-zone="fiche"]']);
    const [kpi, liste, graphique, fiche] = r.carte.zones;
    expect(kpi!.aller).toBe("commandes");
    expect(kpi!.gestes).toEqual(["zoom", "apparition"]);
    expect(liste!.gestes).toEqual(["defilement"]);
    expect(graphique!.gestes).toEqual(["apparition", "zoom"]);
    expect(fiche!.gestes).toEqual(["clic"]);
    expect(kpi!.prouve).toBe("Montre : Commandes prêtes");
    expect(kpi!.chiffres).toEqual(["Prêtes"]);
    expect(liste!.chiffres).toEqual([]);
    expect(kpi!.etat).toBe("les-deux");
  });

  it("état d'une zone : « avant » ou « maintenant » seuls quand toutes ses données le sont", () => {
    const o = brute();
    o.ecrans[0]!.zones[0]!.donnees = [{ id: "a", libelle: "Prêtes", valeur: 4, exemple: true, etat: "avant" }] as never;
    const r = carteDepuisDescription(decrire(o));
    expect(r.ok && r.carte.zones[0]!.etat).toBe("avant");
  });

  it("moins de 3 zones ou plus de 12 : refus", () => {
    const o = brute();
    o.ecrans[0]!.zones = o.ecrans[0]!.zones.slice(0, 1);
    const r = carteDepuisDescription(decrire(o));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(" ")).toContain("3 à 12 zones");
    const grande = brute();
    const modele = grande.ecrans[0]!.zones[1]!;
    grande.ecrans[0]!.zones = Array.from({ length: 8 }, (_, i) => ({ ...modele, id: `z-${i}` })) as never;
    grande.ecrans[1]!.zones = Array.from({ length: 5 }, (_, i) => ({ ...modele, id: `y-${i}` })) as never;
    const r13 = carteDepuisDescription(decrire(grande));
    expect(r13.ok).toBe(false);
  });
});

describe("tableauDepuisDescription (G4)", () => {
  it("tableau relu par lireTableauDeBord, marqué exemple, avec comparaison avant / après et une série", () => {
    const d = decrire();
    const t = tableauDepuisDescription(d, "2026-11-18");
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(lireTableauDeBord(t.donnee).ok).toBe(true);
    expect(t.donnee.source).toBe("Données exemple");
    expect(t.donnee.periode).toEqual({ debut: "2026-11-18", fin: "2026-11-18", libelle: "Exemple" });
    expect(t.donnee.indicateurs.map((i) => i.id)).toEqual(["prets-avant", "prets-apres", "lundi", "mardi"]);
    expect(t.donnee.comparaisons).toEqual([{ avant: "prets-avant", apres: "prets-apres" }]);
    expect(t.donnee.series).toHaveLength(1);
    expect(t.donnee.series[0]!.points.map((p) => p.valeur)).toEqual([3, 5]);
  });

  it("garderChiffres : 12 est une donnée, 13 est refusé", () => {
    const t = tableauDepuisDescription(decrire(), "2026-11-18");
    if (!t.ok) throw new Error(t.erreurs.join("|"));
    expect(garderChiffres(t.donnee, { textesEcran: [], texteDit: "Vous voyez 12 commandes prêtes" }).ok).toBe(true);
    const mauvais = garderChiffres(t.donnee, { textesEcran: [], texteDit: "Vous voyez 13 commandes prêtes" });
    expect(mauvais.ok).toBe(false);
    expect(mauvais.horsDonnee.map((h) => h.valeur)).toEqual([13]);
  });

  it("données sans doublon d'identifiant et décimales gardées", () => {
    const o = brute();
    o.ecrans[1]!.zones.push({ id: "bis", type: "kpi", libelle: "Autre", donnees: [{ id: "lundi", libelle: "Taux", valeur: "2,5 %", exemple: true }] } as never);
    const t = tableauDepuisDescription(decrire(o), "2026-11-18");
    expect(t.ok).toBe(true);
    if (t.ok) {
      const ids = t.donnee.indicateurs.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(t.donnee.indicateurs.at(-1)).toMatchObject({ valeur: 2.5, precision: 1 });
    }
  });
});

describe("controlerTextesCrees", () => {
  it("la maquette de base est propre", () => {
    expect(controlerTextesCrees(decrire(), [])).toEqual([]);
  });

  it.each([
    ["Douleur"],
    ["Solution : tout est prêt"],
    ["Exemple"],
    ["À vous"],
    ["Ton atelier"],
    ["Vos commandes sont prêtes."],
    ["Dupont Menuiserie"],
    ["Un deux trois quatre cinq six sept"],
  ])("refuse « %s »", (titre) => {
    expect(refus(titre).length).toBeGreaterThan(0);
  });

  it("accepte les libellés courts, un nom permis et « données exemple »", () => {
    expect(refus("Commandes du jour")).toEqual([]);
    expect(refus("Exemple : commandes").length).toBeGreaterThan(0);
    expect(refus("Données exemple")).toEqual([]);
    expect(refus("Dupont Menuiserie", ["Menuiserie"])).toEqual([]);
    expect(refus("Chez Entreprise exemple")).toEqual([]);
  });

  it("tutoiement avec apostrophe, et état jusqu'à 60 caractères sans point", () => {
    expect(refus("T'attend").length).toBeGreaterThan(0);
    const d = decrire();
    const long = { ...d, etats: { avant: "Des papiers, des appels, des relances et des oublis", maintenant: "Tout est à l'écran" } };
    expect(controlerTextesCrees(long, [])).toEqual([]);
  });

  it("n'affaiblit pas controlerTexteVisible : montant, courriel, bleu refusés", () => {
    expect(refus("Total 12 €").length).toBeGreaterThan(0);
    expect(refus("Écrire à a@b").length).toBeGreaterThan(0);
    expect(refus("Bandeau bleu").length).toBeGreaterThan(0);
  });
});

describe("textesDeLaMaquette", () => {
  it("ordre stable, aucun doublon, nom et chaque libellé présents", () => {
    const d = decrire();
    const a = textesDeLaMaquette(d);
    expect(textesDeLaMaquette(d)).toEqual(a);
    expect(a.map((e) => e.ecranId)).toEqual(["accueil", "fiche-client"]);
    expect(a[0]!.textes.slice(0, 4)).toEqual(["Espace démo · Atelier", "Entreprise exemple", "Vue du jour", "Commandes prêtes"]);
    for (const e of a) expect(new Set(e.textes).size).toBe(e.textes.length);
    const tous = a.flatMap((e) => e.textes);
    for (const t of ["Retards à suivre", "Semaine", "Lundi", "Fiche commande", "Référence", "Lot ouvert", "Papiers et appels", "Tout est à l'écran"]) expect(tous).toContain(t);
    expect(a[0]!.textes.filter((t) => t === "Prêtes")).toHaveLength(1);
  });
});

describe("empreinteDescription", () => {
  it("clés permutées : même empreinte ; un libellé changé : autre empreinte", () => {
    const d = decrire();
    const permutee = JSON.parse(JSON.stringify({ etats: d.etats, ecrans: d.ecrans, metier: d.metier, entreprise: d.entreprise, nom: d.nom, version: d.version })) as DescriptionMaquette;
    expect(empreinteDescription(permutee)).toBe(empreinteDescription(d));
    expect(empreinteDescription(d)).toMatch(/^[0-9a-f]{16}$/);
    expect(empreinteDescription(avecTitre("Autre titre"))).not.toBe(empreinteDescription(d));
  });
});

describe("scenarioApercu", () => {
  it("relu sans erreur, un pas par écran puis « maintenant », sans durée, dernier rôle « appel »", () => {
    const s = scenarioApercu(decrire(), "apercu-atelier");
    expect(lireScenarioMaquette(s).ok).toBe(true);
    expect(s.etapes.map((e) => e.aller)).toEqual(["accueil", "fiche-client", "maintenant"]);
    expect(s.etapes.at(-1)!.role).toBe("appel");
    expect(JSON.stringify(s)).not.toMatch(/duree/i);
  });
});

describe("lireApercu", () => {
  const valide = () => ({
    version: VERSION_APERCU,
    empreinteDescription: "0123456789abcdef",
    images: [{ ecranId: "accueil", etat: "avant", cle: "apercus/v1/accueil-avant.png" }],
    controle: { ok: true, defauts: [] },
  });

  it("accepte un aperçu propre", () => {
    expect(lireApercu(valide()).ok).toBe(true);
  });

  it("refuse 15 images, une clé « ../ », une clé absolue, un champ inconnu, 0 image", () => {
    const image = valide().images[0]!;
    expect(lireApercu({ ...valide(), images: Array.from({ length: 14 }, () => image) }).ok).toBe(true);
    expect(lireApercu({ ...valide(), images: Array.from({ length: 15 }, () => image) }).ok).toBe(false);
    expect(lireApercu({ ...valide(), images: [{ ...image, cle: "../x.png" }] }).ok).toBe(false);
    expect(lireApercu({ ...valide(), images: [{ ...image, cle: "/x.png" }] }).ok).toBe(false);
    expect(lireApercu({ ...valide(), extra: 1 }).ok).toBe(false);
    expect(lireApercu({ ...valide(), images: [] }).ok).toBe(false);
    expect(lireApercu(null).ok).toBe(false);
    expect(lireApercu({ ...valide(), images: [{ ...image, etat: "demain" }] }).ok).toBe(false);
  });
});
