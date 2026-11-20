/** T-EXT-V2-09 : écran « Votre maquette » (service + présentation). Doubles seulement : aucun appel réel, aucun rendu, 0 €. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { empreinteDescription, tableauDepuisDescription, textesDeLaMaquette, VERSION_APERCU } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { PieceCreee, type GestesPiece } from "@/components/tutoriel-outil/PieceCreee";
import {
  arreter,
  autreProposition,
  corrigerTexte,
  enregistrerApercu,
  garderPiece,
  MESSAGE_FERME,
  NOMS_ECRANS_OUTILS,
  NOMS_NEUTRES,
  vuePieceCreee,
  type DependancesPiece,
  type DepotPiece,
  type EtatPieceCreee,
} from "@/services/tutoriel-piece-creee";
import type { Fichier } from "@/domaine/types";

const VIDEO = "v-1";

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
          libelle: "Commandes du jour",
          donnees: [
            { id: "prets-avant", libelle: "Prêtes", valeur: 4, exemple: true, etat: "avant" },
            { id: "prets-apres", libelle: "Prêtes", valeur: 12, exemple: true, etat: "maintenant" },
          ],
        },
        { id: "retards", type: "liste", libelle: "Retards à suivre", donnees: [{ id: "retard-a", libelle: "Table chêne", valeur: "En attente" }] },
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

const description = (): DescriptionMaquette => {
  const r = lireDescriptionMaquette(brute(), { interdits: [] });
  if (!r.ok) throw new Error(r.erreurs.join(" "));
  return r.description;
};

const etatInitial = (plus: Partial<EtatPieceCreee> = {}): EtatPieceCreee => {
  const d = description();
  return { phrase: "un tableau de bord pour un atelier", cas: "tableau-de-bord", proposition: 1, statut: "a-valider", description: d, empreinte: empreinteDescription(d), ...plus };
};

const avecApercu = (e: EtatPieceCreee): EtatPieceCreee => ({
  ...e,
  apercu: { version: VERSION_APERCU, empreinteDescription: e.empreinte, images: [{ ecranId: "accueil", etat: "avant", cle: "f-img1" }, { ecranId: "accueil", etat: "maintenant", cle: "f-img2" }], controle: { ok: true, defauts: [] } },
});

/** Doubles : dépôt en mémoire, compteurs d'écritures, de relances et d'appels à Claude (toujours 0 : aucun n'est branché). */
function monde(initial: EtatPieceCreee | null, reglages: Record<string, unknown> = { "tutoriel.entreePhrase": true, "tutoriel.pieceCreeeClaude": true }) {
  const etats = new Map<string, EtatPieceCreee>();
  if (initial) etats.set(VIDEO, initial);
  const compteurs = { ecritures: 0, relances: 0, appelsClaude: 0 };
  const depot: DepotPiece = {
    lire: async (id) => etats.get(id) ?? null,
    ecrire: async (id, e) => {
      compteurs.ecritures++;
      etats.set(id, e);
    },
  };
  const dep: DependancesPiece = {
    reglage: async <T,>(id: string, defaut: T) => (id in reglages ? (reglages[id] as T) : defaut),
    session: async () => ({}),
    depot,
    relancer: async () => void compteurs.relances++,
    maintenant: () => "2026-11-20T10:00:00.000Z",
    urls: async (ids) => Object.fromEntries(ids.map((i) => [i, `https://exemple.invalid/${i}.png`])),
  };
  return { dep, compteurs, etat: () => etats.get(VIDEO)! };
}

const fichier = (id: string, nom: string): Fichier => ({ id, nom, mime: nom.endsWith(".json") ? "application/json" : "image/png", taille: 10, origine: "depot", statut: "pret", cleStockage: `studio/test/entree/${VIDEO}/${id}`, creeLe: "", modifieLe: "" }) as unknown as Fichier;

const decode = (h: string) => h.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'");

describe("réglages éteints", () => {
  const eteints: Record<string, unknown>[] = [{}, { "tutoriel.entreePhrase": true }, { "tutoriel.pieceCreeeClaude": true }, { "tutoriel.entreePhrase": "true", "tutoriel.pieceCreeeClaude": 1 }];
  it.each(eteints)("chaque geste refuse sans rien écrire (%j)", async (reglages) => {
    const m = monde(avecApercu(etatInitial()), reglages);
    const e = etatInitial();
    const resultats = [
      await garderPiece(VIDEO, { empreinte: e.empreinte }, m.dep),
      await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Commandes prêtes" }, m.dep),
      await autreProposition(VIDEO, m.dep),
      await arreter(VIDEO, m.dep),
      await enregistrerApercu(VIDEO, ["f-1"], m.dep),
    ];
    for (const r of resultats) expect(r).toEqual({ ok: false, message: MESSAGE_FERME });
    expect(m.compteurs).toEqual({ ecritures: 0, relances: 0, appelsClaude: 0 });
  });
});

describe("la vue", () => {
  it("rien à voir sans maquette", async () => {
    expect(await vuePieceCreee(VIDEO, monde(null).dep)).toBeNull();
  });

  it("tous les textes de la maquette, à l'identique, et les chiffres d'exemple", async () => {
    const m = monde(avecApercu(etatInitial()));
    const vue = (await vuePieceCreee(VIDEO, m.dep))!;
    const attendu = textesDeLaMaquette(description());
    expect(vue.textes.map(({ ecranId, textes }) => ({ ecranId, textes }))).toEqual(attendu);
    expect(vue.chiffres.map((c) => c.valeur)).toContain(12);
    expect(vue.propositionsRestantes).toBe(1);
    expect(vue.apercu).toHaveLength(2);
    expect(m.compteurs.ecritures).toBe(0);
  });

  it("le composant rend chaque texte mot pour mot, sans montant ni étiquette interdite", async () => {
    const vue = (await vuePieceCreee(VIDEO, monde(avecApercu(etatInitial())).dep))!;
    const gestes = {} as GestesPiece;
    const html = decode(renderToStaticMarkup(createElement(PieceCreee, { videoId: VIDEO, vue, gestes })));
    for (const { textes } of textesDeLaMaquette(description())) for (const t of textes) expect(html).toContain(t);
    for (const interdit of ["€", "$", "Douleur", "Solution", "À vous"]) expect(html).not.toContain(interdit);
    expect(html).toContain("Aperçu : Vue du jour, avant");
    expect(html).toContain("Aperçu : Vue du jour, maintenant");
    for (const libelle of ["Garder cette maquette", "Corriger un texte", "En proposer une autre", "Arrêter"]) expect(html).toContain(libelle);
    expect(html).toContain("Il vous reste 1 autre proposition");
    expect(html).toContain("Le Studio a compris : un tableau de bord à créer.");
  });
});

describe("dépôt de l'aperçu", () => {
  const apercuJson = (empreinte: string) => ({ version: VERSION_APERCU, empreinteDescription: empreinte, images: [{ ecranId: "accueil", etat: "avant", cle: "apercu/avant.png" }, { ecranId: "accueil", etat: "maintenant", cle: "apercu/apres.png" }], controle: { ok: true, defauts: [] } });
  const dep = (m: ReturnType<typeof monde>, json: unknown): DependancesPiece => ({
    ...m.dep,
    fichiers: async () => [fichier("f-j", "apercu-piece.json"), fichier("f-a", "avant.png"), fichier("f-b", "apres.png")],
    lireJson: async () => json,
  });

  it("empreinte égale : chemins locaux remplacés par les identifiants, statut à valider", async () => {
    const m = monde(etatInitial({ statut: "a-construire" }));
    const r = await enregistrerApercu(VIDEO, ["f-j", "f-a", "f-b"], dep(m, apercuJson(m.etat().empreinte)));
    expect(r.ok).toBe(true);
    expect(m.etat().statut).toBe("a-valider");
    expect(m.etat().apercu?.images.map((i) => i.cle)).toEqual(["f-a", "f-b"]);
  });

  it("aperçu d'une autre empreinte : refus", async () => {
    const m = monde(etatInitial({ statut: "a-construire" }));
    const r = await enregistrerApercu(VIDEO, ["f-j", "f-a", "f-b"], dep(m, apercuJson("autre-empreinte")));
    expect(r).toEqual({ ok: false, message: "Cet aperçu ne correspond pas à la maquette proposée" });
    expect(m.compteurs.ecritures).toBe(0);
  });

  it("16 fichiers : refus", async () => {
    const m = monde(etatInitial({ statut: "a-construire" }));
    const r = await enregistrerApercu(VIDEO, Array.from({ length: 16 }, (_, i) => `f-${i}`), dep(m, {}));
    expect(r.ok).toBe(false);
    expect(m.compteurs.ecritures).toBe(0);
  });
});

describe("garder", () => {
  it("avec la bonne empreinte : gardée, travail relancé", async () => {
    const e = avecApercu(etatInitial());
    const m = monde(e);
    const r = await garderPiece(VIDEO, { empreinte: e.empreinte }, m.dep);
    expect(r.ok).toBe(true);
    expect(m.etat().statut).toBe("gardee");
    expect(m.etat().gardee).toEqual({ empreinte: e.empreinte, le: "2026-11-20T10:00:00.000Z" });
    expect(m.compteurs.relances).toBe(1);
    expect(m.compteurs.appelsClaude).toBe(0);
  });

  it("avec une ancienne empreinte : refus, rien n'est écrit", async () => {
    const m = monde(avecApercu(etatInitial()));
    const r = await garderPiece(VIDEO, { empreinte: "ancienne" }, m.dep);
    expect(r.ok).toBe(false);
    expect(m.etat().statut).toBe("a-valider");
    expect(m.compteurs.ecritures).toBe(0);
  });

  it("chiffre « 12 » corrigé en « 14 » : description et tableau G4 à 14, nouvel aperçu à faire", async () => {
    const e = avecApercu(etatInitial());
    const m = monde(e);
    const r = await garderPiece(VIDEO, { empreinte: e.empreinte, chiffres: { "indicateur:prets-apres": { type: "corrige", valeur: 14 } } }, m.dep);
    expect(r).toMatchObject({ ok: true, statut: "a-construire" });
    const nouvelle = m.etat().description as DescriptionMaquette;
    expect(nouvelle.ecrans[0]!.zones[0]!.donnees[1]!.valeur).toBe(14);
    expect(m.etat().empreinte).not.toBe(e.empreinte);
    expect(m.etat().gardee).toBeUndefined();
    const tableau = tableauDepuisDescription(nouvelle, "2026-11-20");
    expect(tableau.ok && tableau.donnee.indicateurs.find((i) => i.id === "prets-apres")?.valeur).toBe(14);
    expect(m.compteurs.relances).toBe(0);
  });
});

describe("corriger un texte", () => {
  it("« Commandes du jour » → « Commandes prêtes » : remplacé à l'identique, nouvelle empreinte, à construire", async () => {
    const e = avecApercu(etatInitial());
    const m = monde(e);
    const r = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Commandes prêtes" }, m.dep);
    expect(r).toMatchObject({ ok: true, statut: "a-construire" });
    expect((m.etat().description as DescriptionMaquette).ecrans[0]!.zones[0]!.libelle).toBe("Commandes prêtes");
    expect(m.etat().empreinte).not.toBe(e.empreinte);
    expect(m.etat().statut).toBe("a-construire");
    expect(m.etat().apercu).toBeUndefined();
    expect(m.compteurs.appelsClaude).toBe(0);
    expect(m.compteurs.relances).toBe(0);
  });

  it("« Ton atelier » : refus (tutoiement), rien n'est écrit", async () => {
    const m = monde(avecApercu(etatInitial()));
    const r = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Ton atelier" }, m.dep);
    expect(r.ok).toBe(false);
    expect(m.compteurs.ecritures).toBe(0);
  });
});

describe("autre proposition et arrêt", () => {
  it("1re fois : proposition 2, travail relancé, aucun appel fait par le service ; 2e fois : refus", async () => {
    const m = monde(avecApercu(etatInitial()));
    const r = await autreProposition(VIDEO, m.dep);
    expect(r.ok).toBe(true);
    expect(m.etat().proposition).toBe(2);
    expect(m.etat().statut).toBe("a-construire");
    expect(m.compteurs).toMatchObject({ relances: 1, appelsClaude: 0 });
    const encore = await autreProposition(VIDEO, m.dep);
    expect(encore).toEqual({ ok: false, message: "Vous avez déjà demandé une autre proposition" });
    expect(m.compteurs.relances).toBe(1);
    expect((await vuePieceCreee(VIDEO, m.dep))?.propositionsRestantes).toBe(0);
  });

  it("arrêter : statut refusée", async () => {
    const m = monde(avecApercu(etatInitial()));
    expect((await arreter(VIDEO, m.dep)).ok).toBe(true);
    expect(m.etat().statut).toBe("refusee");
  });
});

describe("corrections du verdict Opus", () => {
  it("autre proposition en attente : corriger un texte est refusé, rien n'est écrit, l'état reste à relancer", async () => {
    const m = monde(avecApercu(etatInitial()));
    await autreProposition(VIDEO, m.dep);
    const ecritures = m.compteurs.ecritures;
    const r = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Commandes prêtes" }, m.dep);
    expect(r).toEqual({ ok: false, message: "Une autre proposition se prépare : attendez-la." });
    expect(m.compteurs.ecritures).toBe(ecritures);
    expect(m.etat()).toMatchObject({ proposition: 2, aRelancer: true });
    expect((await vuePieceCreee(VIDEO, m.dep))?.autreEnAttente).toBe(true);
  });

  it("autre proposition en attente : le dépôt de l'aperçu de l'ancienne description est refusé", async () => {
    const m = monde(avecApercu(etatInitial()));
    await autreProposition(VIDEO, m.dep);
    const ancienne = m.etat().empreinte;
    const dep: DependancesPiece = {
      ...m.dep,
      fichiers: async () => [fichier("f-j", "apercu-piece.json"), fichier("f-a", "avant.png"), fichier("f-b", "apres.png")],
      lireJson: async () => ({ version: VERSION_APERCU, empreinteDescription: ancienne, images: [{ ecranId: "accueil", etat: "avant", cle: "a/avant.png" }, { ecranId: "accueil", etat: "maintenant", cle: "a/apres.png" }], controle: { ok: true, defauts: [] } }),
    };
    const ecritures = m.compteurs.ecritures;
    const r = await enregistrerApercu(VIDEO, ["f-j", "f-a", "f-b"], dep);
    expect(r).toEqual({ ok: false, message: "Une autre proposition se prépare : attendez-la." });
    expect(m.compteurs.ecritures).toBe(ecritures);
    expect(m.etat().statut).toBe("a-construire");
  });

  it("arrêter une maquette gardée : refus, rien n'est écrit ; le bouton est grisé", async () => {
    const e = avecApercu(etatInitial());
    const m = monde(e);
    await garderPiece(VIDEO, { empreinte: e.empreinte }, m.dep);
    const ecritures = m.compteurs.ecritures;
    expect(await arreter(VIDEO, m.dep)).toEqual({ ok: false, message: "Cette maquette est déjà gardée." });
    expect(m.compteurs.ecritures).toBe(ecritures);
    expect(m.etat().statut).toBe("gardee");
    const vue = (await vuePieceCreee(VIDEO, m.dep))!;
    const html = renderToStaticMarkup(createElement(PieceCreee, { videoId: VIDEO, vue, gestes: {} as GestesPiece }));
    expect(/<button[^>]*disabled[^>]*>\s*Arrêter/.test(html)).toBe(true);
  });

  it("noms non neutres : sans listes fournies, celles de la charte sont lues et « Velora du jour » est refusé", async () => {
    const m = monde(avecApercu(etatInitial()));
    const r = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Velora du jour" }, m.dep);
    expect(r.ok).toBe(false);
    expect(m.compteurs.ecritures).toBe(0);
  });

  it("noms non neutres : une marque inventée hors liste est refusée, un nom permis reste accepté", async () => {
    const m = monde(avecApercu(etatInitial()));
    const r = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Commandes Zorbix" }, m.dep);
    expect(r.ok).toBe(false);
    expect(m.compteurs.ecritures).toBe(0);
    const ok = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Commandes prêtes" }, m.dep);
    expect(ok.ok).toBe(true);
  });

  it("deux « En proposer une autre » simultanés : une seule relance, un seul refus", async () => {
    const m = monde(avecApercu(etatInitial()));
    const [a, b] = await Promise.all([autreProposition(VIDEO, m.dep), autreProposition(VIDEO, m.dep)]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(m.compteurs.relances).toBe(1);
    expect(m.compteurs.ecritures).toBe(1);
  });

  describe("noms de la charte dans l'image du studio", () => {
    const lire = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "outils", "maquettes-tableaux-de-bord", f), "utf8")) as { interdits: string[]; maquettes: unknown };

    it("la copie sous src/ est identique aux deux fichiers d'outils/", () => {
      const n = lire("charte/noms-neutres.json");
      const e = lire("ecrans-outils/noms.json");
      expect(NOMS_NEUTRES).toEqual({ interdits: n.interdits, maquettes: n.maquettes });
      expect(NOMS_ECRANS_OUTILS).toEqual({ interdits: e.interdits, maquettes: e.maquettes });
    });

    it("le service ne lit aucun fichier d'outils/ à l'exécution", () => {
      const source = readFileSync(join(process.cwd(), "src", "services", "tutoriel-piece-creee.ts"), "utf8");
      expect(source).not.toMatch(/readFile|process\.cwd|node:fs|"outils"/);
    });

    it("lecteur de noms en échec : la vue reste lisible, chaque geste refuse sans lever ni écrire", async () => {
      const m = monde(avecApercu(etatInitial()));
      const dep: DependancesPiece = { ...m.dep, noms: async () => { throw new Error("fichier absent"); } };
      const vue = (await vuePieceCreee(VIDEO, dep))!;
      expect(vue.nomsIllisibles).toBe(true);
      expect(vue.textes.length).toBeGreaterThan(0);
      const html = renderToStaticMarkup(createElement(PieceCreee, { videoId: VIDEO, vue, gestes: {} as GestesPiece }));
      expect(decode(html)).toContain("Commandes du jour");
      // « Garder » grisé quand les noms sont illisibles (le serveur refuse aussi).
      expect(/<button[^>]*disabled[^>]*>\s*Garder/.test(html)).toBe(true);
      const e = etatInitial();
      const rs = [
        await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Commandes prêtes" }, dep),
        await garderPiece(VIDEO, { empreinte: e.empreinte }, dep),
        await enregistrerApercu(VIDEO, ["f-1"], dep),
      ];
      for (const r of rs) expect(r.ok).toBe(false);
      expect(m.compteurs.ecritures).toBe(0);
      expect(m.etat().statut).toBe("a-valider");
    });

    it("lecteur de noms qui rend des listes vides : même refus (jamais « tout permis »)", async () => {
      const m = monde(avecApercu(etatInitial()));
      const dep: DependancesPiece = { ...m.dep, noms: async () => ({ interdits: [], permis: [] }) };
      const r = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Velora du jour" }, dep);
      expect(r.ok).toBe(false);
      expect(m.compteurs.ecritures).toBe(0);
    });

    it("listes passées par l'appelant avec interdits vides : refus aussi, jamais « tout permis »", async () => {
      const m = monde(avecApercu(etatInitial()));
      const dep: DependancesPiece = { ...m.dep, interdits: [], nomsPermis: [], noms: async () => ({ interdits: [], permis: [] }) };
      const r = await corrigerTexte(VIDEO, { ecranId: "accueil", avant: "Commandes du jour", apres: "Velora du jour" }, dep);
      expect(r.ok).toBe(false);
      expect(m.compteurs.ecritures).toBe(0);
    });
  });
});
