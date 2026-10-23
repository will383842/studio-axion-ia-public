/**
 * INCIDENT RÉEL DU 12/10 (vidéo `v-9d15cce3c6e3`, fiche `temoins/fiche-consigne-ia-prod.json`) : la dernière scène ne
 * disait QUE l'appel (« Écrivez CONSIGNE en commentaire. Je vous l'envoie. »). Une fois l'appel retiré pour le vertical
 * de TikTok et Shorts, elle n'avait plus aucun mot mais gardait un écran et des éléments ancrés : la relecture d'avant
 * le prix disait « Tout est bon », la voix était payée, puis la fabrication s'arrêtait au calage du second vertical.
 *
 * Ici, sans aucun appel payant : la scène vidée est supprimée et la scène d'avant porte l'écran du site ; les cas
 * voisins (appel au milieu, à cheval sur deux scènes, suivi d'une clôture, amorce écrite plus tôt) ; la relecture qui
 * voit le défaut AVANT la voix ; la reprise d'une vidéo arrêtée sans repayer la voix ; les quatre fiches témoins.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TABLE_FINS } from "../../../src/briques/fins";
import { mots } from "../../../src/domaine/controles-script/texte";
import { controlerFormeSortie } from "../../../src/moteurs/montage-tableau/controles";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import {
  validerFicheTableau,
  type FicheTableau,
  type SceneTableau,
} from "../../../src/moteurs/montage-tableau/fiche";
import {
  sortiesDesReseaux,
  type IdSortie,
} from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import {
  textesEcrits,
  textesEcransScene,
  type ContexteTableau,
} from "../../../src/moteurs/montage-tableau/regles";
import {
  finDeLaSortie,
  relireFicheTableau,
  sortiesRelues,
  type FinRetenue,
} from "../../../src/moteurs/montage-tableau/relecture";
import {
  ficheDeVariante,
  planVoixSorties,
  SITE_FIN,
  texteCorps,
  trouverAppel,
} from "../../../src/moteurs/montage-tableau/variantes-fin";
import {
  choisirFinTableau,
  finEtAppelDuTableau,
  reseauDeLaSortie,
} from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";

const lire = (nom: string) =>
  JSON.parse(
    readFileSync(new URL(`../temoins/${nom}`, import.meta.url), "utf8"),
  ) as FicheTableau;
const reelle = lire("fiche-consigne-ia-prod.json");
const sorties = sortiesDesReseaux(["verticaux"]);
const coche = { coche: true, le: "2026-10-12" };

/** Contexte des règles de la production : le texte de la fiche, ses démonstrations validées. */
function contexteDe(fiche: FicheTableau): ContexteTableau {
  const ids = [
    ...new Set(
      fiche.scenes
        .flatMap((s) => s.elements)
        .flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])),
    ),
  ];
  return {
    aujourdhui: "2026-10-12",
    sourcesChiffres: [],
    preuves: [],
    matieres: ids.map((id) => ({
      id,
      type: "demonstration",
      statut: "validee",
      perimeLe: "2027-01-09",
    })),
    texteScript: fiche.scenes.map((s) => s.texteDit).join(" "),
  };
}

type ChoisirFin = (appelId: string | null, sortie: IdSortie) => FinRetenue;
/** Table réelle : aucune fin validée pour TikTok et Shorts (fin « adresse seule »). */
const sansFinValidee = (mot: string): ChoisirFin =>
  choisirFinTableau({}, { sorties, mot });
/** Fin validée pour TikTok et Shorts (« Le lien est dans mon profil. ») : elle remplace l'appel. */
const avecFinValidee =
  (mot: string): ChoisirFin =>
  (appelId, sortie) =>
    finEtAppelDuTableau(
      reseauDeLaSortie(sortie, {}, sorties),
      appelId,
      TABLE_FINS.map((f) =>
        f.id === "fin-ty-lien-profil" ? { ...f, validee: true } : f,
      ),
      { mot },
    );

/** La fiche du vertical de TikTok et Shorts, telle que la relecture et la fabrication la construisent. */
const ficheLiens = (fiche: FicheTableau, choisir: ChoisirFin) =>
  sortiesRelues(fiche, sorties, (id) =>
    finDeLaSortie(id, choisir(fiche.appelId ?? null, id)),
  )[1].fiche;

/** Ce qui arrêtait le calage, et ce qui ne doit plus jamais être écrit sur TikTok et Shorts. */
function attendreFinPropre(f: FicheTableau, mot: string): void {
  for (const s of f.scenes) {
    const n = mots(s.texteDit).length;
    expect(n, `${s.id} sans mot`).toBeGreaterThan(0);
    for (const e of s.elements)
      if ("ancre" in e) expect(e.ancre, `${s.id} · ${e.id}`).toBeLessThan(n);
    for (const [k, ec] of (s.ecrans ?? []).entries()) {
      expect(ec.ancre ?? 0, `${s.id} · écran ${k + 1}`).toBeLessThan(n);
      for (const it of ec.liste ?? []) expect(it.ancre).toBeLessThan(n);
      expect(ec.motCommentaire).toBeUndefined();
    }
    const textes = [
      s.texteDit,
      ...s.elements.flatMap(textesEcrits),
      ...textesEcransScene(s),
    ].join(" | ");
    expect(textes).not.toMatch(
      /comment(aire|ez)|vous l['’]envoie|vous les envoie/i,
    );
    expect(textes).not.toMatch(new RegExp(`(écrivez|tapez) ${mot}`, "i"));
  }
  // L'écran de fin (le site) termine la vidéo.
  expect(f.scenes.at(-1)!.ecrans?.at(-1)?.moment).toBe("appel");
}

/** Relecture d'avant le prix et fabrication simulée des deux verticaux : aucun point, deux fichiers. */
async function relireEtFabriquer(
  fiche: FicheTableau,
  choisirFin: ChoisirFin,
): Promise<void> {
  const contexte = contexteDe(fiche);
  expect(validerFicheTableau(fiche, contexte).ok).toBe(true);
  const r = await relireFicheTableau({
    fiche,
    contexte,
    sorties,
    choisirFin,
    dejaVu: coche,
  });
  expect(r.points).toEqual([]);
  const d = doubles(fiche);
  const fab = await fabriquerTableau({
    ...d.outils,
    contexte,
    sorties,
    choisirFin,
    dejaVu: coche,
  });
  expect(fab.sorties.map((s) => s.format)).toEqual([
    "vertical",
    "vertical-liens",
  ]);
}

describe("la fiche réelle de l'incident : la dernière scène ne dit que l'appel", () => {
  const liens = ficheLiens(reelle, sansFinValidee("CONSIGNE"));

  it("la scène vidée (s10) est supprimée ; s09 porte l'écran du site, sur son dernier mot", () => {
    expect(liens.scenes.map((s) => s.id)).toEqual(
      reelle.scenes.slice(0, -1).map((s) => s.id),
    );
    const s09 = liens.scenes.at(-1)!;
    const avant = reelle.scenes[8];
    expect(s09.texteDit).toBe(avant.texteDit);
    expect(s09.ecrans).toEqual([
      avant.ecrans![0],
      {
        moment: "appel",
        etiquette: "À vous",
        ancre: mots(avant.texteDit).length - 1,
      },
    ]);
    // Ce que montrait le récapitulatif reste : seul ce qui partait du dernier mot (sous l'écran du site) en sort.
    expect(s09.elements).toEqual(avant.elements);
    attendreFinPropre(liens, "CONSIGNE");
    // Les scènes communes sont celles du premier vertical, telles quelles.
    expect(liens.scenes.slice(0, -1)).toEqual(reelle.scenes.slice(0, -2));
  });

  it("l'écran de fin est celui de la fin « adresse seule » : le site en grand, rien d'autre", () => {
    const [, s] = sortiesRelues(reelle, sorties, (id) =>
      finDeLaSortie(id, sansFinValidee("CONSIGNE")(reelle.appelId ?? null, id)),
    );
    const fin = mettreEnPage(s.fiche, s.options).styleV2!.ecrans.at(-1)!;
    expect(fin).toMatchObject({
      sceneId: "s09",
      moment: "appel",
      gabarit: "appel-site",
      final: true,
    });
    expect(
      fin.textes.filter((t) => !t.horsContenu).map((t) => t.texte),
    ).toEqual([SITE_FIN]);
  });

  it("la fin validée de TikTok et Shorts remplace l'appel : s10 la dit, sous l'écran du site", () => {
    const f = ficheLiens(reelle, avecFinValidee("CONSIGNE"));
    expect(f.scenes).toHaveLength(reelle.scenes.length);
    expect(f.scenes.at(-1)!.texteDit).toBe("Le lien est dans mon profil.");
    expect(f.scenes.at(-1)!.elements).toEqual([
      expect.objectContaining({ type: "ligne", texte: SITE_FIN, ancre: 0 }),
    ]);
    attendreFinPropre(f, "CONSIGNE");
  });

  it("relecture d'avant le prix et fabrication simulée : les DEUX verticaux, sans fin validée", async () => {
    await relireEtFabriquer(reelle, sansFinValidee("CONSIGNE"));
  });

  it("relecture d'avant le prix et fabrication simulée : les DEUX verticaux, avec la fin validée", async () => {
    await relireEtFabriquer(reelle, avecFinValidee("CONSIGNE"));
  });

  it("les scènes communes du second vertical sont reprises du premier ; seule la dernière page est dessinée", async () => {
    const d = doubles(reelle);
    const fab = await fabriquerTableau({
      ...d.outils,
      contexte: contexteDe(reelle),
      sorties,
      choisirFin: sansFinValidee("CONSIGNE"),
      dejaVu: coche,
    });
    // 14/10 : s10 dit la demande de TikTok et Shorts (« Enregistrez… ») ; s09 partage sa page, elle est redessinée.
    expect(fab.sorties[1].scenes).toEqual({
      rendues: ["s09", "s10"],
      reprises: ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08"],
    });
    // Le corps lu une fois, l'appel et la demande de TikTok à part : trois lectures.
    expect(d.lectures()).toBe(3);
  });
});

describe("la relecture d'avant le prix voit le défaut de la fiche propre à TikTok et Shorts", () => {
  /** La fiche de l'incident, telle que la construisait le code d'avant : s10 vide, son écran et ses éléments gardés. */
  const commeAvant = (): FicheTableau => {
    const s10 = reelle.scenes.at(-1)!;
    return {
      ...reelle,
      scenes: [
        ...reelle.scenes.slice(0, -1),
        {
          ...s10,
          texteDit: "",
          ecrans: [{ moment: "appel", etiquette: "À vous" }],
        },
      ],
    };
  };

  it("règles de FORME (pas de rythme estimé) : la scène vide est refusée, rattachée à s10", () => {
    const refus = controlerFormeSortie(commeAvant(), contexteDe(reelle), {
      sansCommentaire: true,
    });
    expect(refus.length).toBeGreaterThan(0);
    expect(
      refus.every(
        (l) => l.bloquant && l.etat === "echoue" && l.scenes?.includes("s10"),
      ),
    ).toBe(true);
  });

  it("un texte qui parle encore de commentaire est refusé sur TikTok et Shorts (et permis ailleurs)", () => {
    expect(
      controlerFormeSortie(reelle, contexteDe(reelle), {
        sansCommentaire: true,
      }).map((l) => l.libelle),
    ).toEqual(["Règle « fin sans commentaire »"]);
    expect(controlerFormeSortie(reelle, contexteDe(reelle))).toEqual([]);
  });

  it("une fiche de sortie qui ne se construit pas : un point bloquant, jamais « Tout est bon »", async () => {
    const r = await relireFicheTableau({
      fiche: reelle,
      contexte: contexteDe(reelle),
      sorties,
      dejaVu: coche,
      choisirFin: () => {
        throw new Error("fin illisible");
      },
    });
    expect(r.ok).toBe(false);
    expect(r.points.map((p) => p.message).join(" ")).toMatch(
      /n'a pas pu être préparée \(fin illisible\)/,
    );
  });
});

describe("cas voisins : aucune scène à 0 mot avec des ancres, aucun texte écrit sur le commentaire", () => {
  /** La fiche réelle, ses deux dernières scènes changées. */
  const variante = (
    s09: Partial<SceneTableau>,
    s10: Partial<SceneTableau>,
  ): FicheTableau => {
    const [a, b] = reelle.scenes.slice(-2);
    return {
      ...reelle,
      scenes: [
        ...reelle.scenes.slice(0, -2),
        { ...a, ...s09 },
        { ...b, ...s10 },
      ],
    };
  };
  const s09 = reelle.scenes[8];
  const s10 = reelle.scenes[9];
  const PHRASE = "Le lien est dans mon profil.";
  const cas: {
    nom: string;
    fiche: FicheTableau;
    reste: string;
    avecPhrase?: string;
  }[] = [
    {
      nom: "appel au milieu de la dernière scène",
      fiche: variante(
        {},
        {
          texteDit:
            "Votre modèle est prêt. Écrivez CONSIGNE en commentaire. Je vous l'envoie. À vous de jouer.",
          elements: [
            {
              id: "e43",
              role: "regle",
              type: "ligne",
              ancre: 6,
              texte: "CONSIGNE",
              marque: "entoure",
              niveau: "titre",
            },
            {
              id: "e44",
              cote: "centre",
              type: "dessin",
              ancre: 1,
              dessinId: "bulle",
            },
            {
              id: "e45",
              role: "resultat",
              type: "ligne",
              ancre: 14,
              texte: "À vous de jouer",
              niveau: "texte",
            },
          ],
        },
      ),
      reste: "Votre modèle est prêt. À vous de jouer.",
      avecPhrase: `Votre modèle est prêt. ${PHRASE} À vous de jouer.`,
    },
    {
      nom: "appel suivi d'une phrase de clôture",
      fiche: variante(
        {},
        {
          texteDit:
            "Écrivez CONSIGNE en commentaire. Je vous l'envoie. Quatre lignes suffisent.",
          elements: [
            ...s10.elements,
            {
              id: "e45",
              role: "resultat",
              type: "ligne",
              ancre: 8,
              texte: "Quatre lignes suffisent",
              niveau: "texte",
            },
          ],
        },
      ),
      reste: "Quatre lignes suffisent.",
      avecPhrase: `${PHRASE} Quatre lignes suffisent.`,
    },
    {
      nom: "appel réparti sur deux scènes",
      fiche: variante(
        { texteDit: `${s09.texteDit} Écrivez CONSIGNE` },
        {
          texteDit: "en commentaire. Je vous l'envoie.",
          elements: [
            {
              id: "e43",
              role: "regle",
              type: "ligne",
              ancre: 0,
              texte: "CONSIGNE",
              marque: "entoure",
              niveau: "titre",
            },
            {
              id: "e44",
              cote: "centre",
              type: "dessin",
              ancre: 2,
              dessinId: "bulle",
            },
          ],
        },
      ),
      reste: s09.texteDit,
    },
    {
      nom: "mot à commenter écrit dans une scène antérieure",
      fiche: variante(
        {
          elements: [
            ...s09.elements.slice(0, -1),
            {
              id: "e42",
              role: "resultat",
              type: "ligne",
              ancre: 7,
              texte: "Écrivez CONSIGNE",
              marque: "souligne",
              niveau: "titre",
            },
          ],
          ecrans: [{ ...s09.ecrans![0], motsForts: ["CONSIGNE"] }],
        },
        {},
      ),
      reste: s09.texteDit,
    },
  ];

  for (const c of cas) {
    for (const [fin, choisir] of [
      ["sans fin validée", sansFinValidee("CONSIGNE")],
      ["avec la fin validée", avecFinValidee("CONSIGNE")],
    ] as const) {
      it(`${c.nom}, ${fin} : fin propre, relecture et fabrication des deux verticaux`, async () => {
        const f = ficheLiens(c.fiche, choisir);
        attendreFinPropre(f, "CONSIGNE");
        const dit = f.scenes.map((s) => s.texteDit).join(" ");
        expect(
          dit.startsWith(
            reelle.scenes
              .slice(0, -2)
              .map((s) => s.texteDit)
              .join(" "),
          ),
        ).toBe(true);
        expect(
          dit.endsWith(
            fin === "sans fin validée" ? c.reste : (c.avecPhrase ?? PHRASE),
          ),
        ).toBe(true);
        await relireEtFabriquer(c.fiche, choisir);
      }, 30_000);
    }
  }

  it("appel à cheval : trouvé dans les deux scènes, mot pour mot ou par ses phrases", () => {
    const f = cas[2].fiche;
    const attendu = {
      scene: 9,
      debut: 0,
      fin: 5,
      enFin: true,
      texte: "Écrivez CONSIGNE en commentaire. Je vous l'envoie.",
      avant: { scene: 8, debut: 13 },
    };
    expect(trouverAppel(f)).toEqual(attendu);
    expect(
      trouverAppel(f, "Écrivez CONSIGNE en commentaire. Je vous l'envoie."),
    ).toEqual(attendu);
  });
});

describe("reprise de la vidéo arrêtée : « Reprendre la fabrication » refait la seule sortie manquante, sans repayer la voix", () => {
  it("le corps de la voix garde le texte (et donc l'empreinte) qu'il avait au journal de la vidéo arrêtée", () => {
    const plan = planVoixSorties(reelle, [
      {
        id: "vertical",
        fin: finDeLaSortie(
          "vertical",
          sansFinValidee("CONSIGNE")(reelle.appelId ?? null, "vertical"),
        ),
      },
      {
        id: "vertical-liens",
        fin: finDeLaSortie(
          "vertical-liens",
          sansFinValidee("CONSIGNE")(reelle.appelId ?? null, "vertical-liens"),
        ),
      },
    ]);
    expect(plan.mode).toBe("raccord");
    if (plan.mode !== "raccord") return;
    // Code d'avant : la scène vidée comptait pour un texte vide (d'où l'espace final).
    const avant = `${reelle.scenes
      .slice(0, -1)
      .map((s) => s.texteDit)
      .join(" ")} `;
    expect(plan.lectures.map((l) => [l.id, l.texte])).toEqual([
      ["corps", avant],
      ["fin-1", "Écrivez CONSIGNE en commentaire. Je vous l'envoie."],
    ]);
    expect(texteCorps(reelle, trouverAppel(reelle))).toBe(avant);
    expect(ficheDeVariante(reelle, trouverAppel(reelle)).scenes).toHaveLength(
      9,
    );
  });

  it("journal d'une vidéo arrêtée après le premier vertical : aucune lecture, le vertical repris, le second fait", async () => {
    const contexte = contexteDe(reelle);
    const choisirFin = sansFinValidee("CONSIGNE");
    const premier = doubles(reelle);
    await fabriquerTableau({
      ...premier.outils,
      contexte,
      sorties,
      choisirFin,
      dejaVu: coche,
    });
    expect(premier.lectures()).toBe(3);
    // L'état du journal au moment de l'arrêt : voix (corps, appel, demande de TikTok) et premier vertical faits, rien du second.
    const journal = premier.journal.valeur!;
    delete journal.sorties?.["vertical-liens"];
    // … et aucun fichier du second (le premier vertical a dessiné ses 10 scènes avant).
    const duSecond = premier
      .scenesSoumises()
      .slice(reelle.scenes.length)
      .map((d) => d.sortie.cle);
    expect(duSecond).toHaveLength(2);
    for (const cle of [
      ...duSecond,
      ...premier
        .compositionsSoumises()
        .slice(1)
        .map((d) => d.sortie.cle),
    ])
      premier.fichiers.delete(cle);

    const relance = doubles(reelle, {
      partage: { fichiers: premier.fichiers, journal: premier.journal },
    });
    const r = await fabriquerTableau({
      ...relance.outils,
      contexte,
      sorties,
      choisirFin,
      dejaVu: coche,
    });
    expect(relance.lectures()).toBe(0);
    expect(r.coutCentimes).toBe(0);
    expect(r.sorties.map((s) => s.format)).toEqual([
      "vertical",
      "vertical-liens",
    ]);
    const etapes = (sortie?: string) =>
      r.etapes.filter((e) => e.sortie === sortie);
    // Tout ce qui a un coût (voix, calage, scènes, composition) est repris ; les contrôles se refont (sans appel).
    expect(
      etapes(undefined)
        .filter((e) => e.etape !== "controles")
        .every((e) => e.statut === "reprise"),
    ).toBe(true);
    expect(etapes("vertical-liens").some((e) => e.statut === "faite")).toBe(
      true,
    );
    // Seule la dernière page est dessinée pour le second vertical (s09 et s10, qui dit la demande) ; aucune du premier.
    expect(relance.scenesSoumises().map((d) => d.sortie.cle)).toEqual(duSecond);
    expect(relance.compositionsSoumises()).toHaveLength(1);
  });
});

describe("les quatre fiches témoins du dépôt fabriquent leurs deux verticaux (simulation)", () => {
  for (const [nom, mot] of [
    ["fiche-consigne-ia-prod.json", "CONSIGNE"],
    ["fiche-habitude-equipe-prod.json", "HABITUDE"],
    ["fiche-relances-prod.json", "RELANCE"],
    ["fiche-taches-repetitives-prod.json", "GRILLE"],
  ] as const) {
    it(`${nom} : fin propre, relecture sans point, deux verticaux`, async () => {
      const fiche = lire(nom);
      // Lot B2b : la fiche réelle « habitude-equipe » (1 670 caractères dits, enregistrée le 12/10) dépasse la limite de 90 s au
      // débit de la voix à 165 mots/min (1 520 caractères) : elle est désormais REFUSÉE (durée, et un trou du rythme dû aux
      // ancres posées pour l'ancien débit).
      if (nom === "fiche-habitude-equipe-prod.json") {
        const v = validerFicheTableau(fiche, contexteDe(fiche));
        expect(v.ok ? [] : v.problemes.map((p) => p.message.replace(/^.*?règle « ([^»]*) ».*$/, "$1"))).toEqual(["durée de 90 secondes au plus", "du rythme : un événement visuel toutes les 4 secondes"]);
        return;
      }
      attendreFinPropre(ficheLiens(fiche, sansFinValidee(mot)), mot);
      attendreFinPropre(ficheLiens(fiche, avecFinValidee(mot)), mot);
      await relireEtFabriquer(fiche, sansFinValidee(mot));
      await relireEtFabriquer(fiche, avecFinValidee(mot));
    }, 60_000);
  }
});
