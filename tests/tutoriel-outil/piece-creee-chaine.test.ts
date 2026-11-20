/**
 * T-EXT-V2-08 : la pièce créée depuis une phrase, de la commande jusqu'à l'écran de validation du script, avec les vrais ports de
 * l'équipe (`portsEquipeAvecPhrase`) et un faux chemin de l'argent. Aucun appel à Claude, aucune voix, aucun rendu : 0 €.
 * Le pilote de la boucle ci-dessous refait, pas à pas, ce que fait `pasEquipe` de `chaine.ts` (un rôle par pas, `payerUneFois`).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { appliquerSortie, prochainPas, ROLES_APPELES, type EtatEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { payerUneFois } from "@/moteurs/montage-tutoriel-outil/reprise";
import { PARAM_ENTREE_PHRASE, PARAM_PIECE_CLAUDE } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { ETAPE_PIECE_TUTORIEL, plafondTutorielPhraseUsd } from "@/services/tutoriel-claude";
import { phraseOuverteTutoriel, portsEquipeAvecPhrase } from "@/services/tutoriel-equipe";
import { fauxScenariste } from "./equipe-doubles";

const PHRASE = "un tableau de bord pour un atelier";
const commande = (phrase = PHRASE) => ({ origine: undefined, entrees: { tutorielOutil: { depot: { mode: "phrase", phrase }, fin: "aucune" } } }) as unknown as Pick<CommandeFabrication, "origine" | "entrees">;
const lecteur = (valeurs: Record<string, unknown>) => async <T,>(id: string, defaut: T): Promise<T> => (id in valeurs ? (valeurs[id] as T) : defaut);
const LES_DEUX = { [PARAM_ENTREE_PHRASE]: true, [PARAM_PIECE_CLAUDE]: true };

interface Appel {
  role: string;
  etape: string;
  plafond: number;
}

/** Faux chemin de l'argent : la simulation déterministe du rôle (jamais Claude). Compte chaque appel. */
function double() {
  const appels: Appel[] = [];
  const executer = (async (_videoId: string, role: { id: string; simuler: (e: never) => unknown }, entree: never, opts: { etape: string; plafondPropre: { defautUsd: number } }) => {
    const id = Object.entries(ROLES_APPELES).find(([, d]) => d?.id === role.id)?.[0] ?? role.id;
    appels.push({ role: id, etape: opts.etape, plafond: opts.plafondPropre.defautUsd });
    const donnees = id === "scenariste" ? fauxScenariste({ moments: [] }) : role.simuler(entree);
    return { ok: true, simule: false, donnees, texte: "", modele: "test", coutUsd: 0, jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } };
  }) as never;
  return { appels, executer };
}

const T0 = "2026-11-20T10:00:00.000Z";

/** Refait la boucle de `pasEquipe` : un rôle par pas ; un rôle payant passe par `payerUneFois`, sa sortie est lue au pas suivant. */
async function courir(depart: EtatEquipe, port: Awaited<ReturnType<typeof portsEquipeAvecPhrase>>, sortieScenariste?: (e: EtatEquipe) => unknown, deuxMoments = false) {
  let e = depart;
  let pause: { code: string; message: string } | null = null;
  for (let i = 0; i < 40 && !pause; i++) {
    const lecture = { dossier: null };
    const p = prochainPas(e, lecture, { phraseOuverte: port.phraseOuverte });
    if ("fini" in p) break;
    if ("pause" in p) {
      e = p.etat ?? e;
      pause = p.pause;
      break;
    }
    if (!p.payant) {
      e = p.etat;
      continue;
    }
    const etape = `Tutoriel · ${p.faire}`;
    const faire =
      p.faire === "scenariste" && sortieScenariste
        ? async () => sortieScenariste(e)
        : p.faire === "stratege" && deuxMoments
          ? async () => {
              const f = (await port.appelerRole(p.faire, p.entree)) as { moments: unknown[] };
              return { ...f, moments: f.moments.slice(0, 2) };
            }
          : () => port.appelerRole(p.faire, p.entree);
    const paye = await payerUneFois<unknown>(e.payes, etape, p.empreinteEntree, faire, T0);
    const a = await appliquerSortie({ ...e, payes: paye.registre }, p.faire, paye.resultat, lecture);
    e = a.etat;
    if (!a.ok && a.bloquee) pause = { code: "TO_EQUIPE_BLOQUEE", message: "" };
  }
  return { e, pause };
}

const neuf = (): EtatEquipe => ({ demande: { phrase: PHRASE, ratios: ["4:5"] }, payes: {} });
const apercuGarde = (e: EtatEquipe): EtatEquipe => {
  const p = e.pieceCreee!;
  return { ...e, pieceCreee: { ...p, statut: "gardee", apercu: { version: "apercu-piece.v1", empreinteDescription: p.empreinte, images: [{ ecranId: "accueil", etat: "avant", cle: "apercu/a.png" }], controle: { ok: true, defauts: [] } }, gardee: { empreinte: p.empreinte, le: T0 } } };
};

describe("V2-08 : réglages", () => {
  it("absents, ou un seul des deux, ou une valeur autre que `true` exact : éteint", async () => {
    expect(await phraseOuverteTutoriel(lecteur({}))).toBe(false);
    expect(await phraseOuverteTutoriel(lecteur({ [PARAM_ENTREE_PHRASE]: true }))).toBe(false);
    expect(await phraseOuverteTutoriel(lecteur({ [PARAM_PIECE_CLAUDE]: true }))).toBe(false);
    expect(await phraseOuverteTutoriel(lecteur({ [PARAM_ENTREE_PHRASE]: "true", [PARAM_PIECE_CLAUDE]: 1 }))).toBe(false);
    expect(await phraseOuverteTutoriel(async () => Promise.reject(new Error("panne")))).toBe(false);
    expect(await phraseOuverteTutoriel(lecteur(LES_DEUX))).toBe(true);
  });
});

describe("V2-08 : la chaîne depuis une phrase", () => {
  it("réglages absents, ou un seul allumé : TO_CAS_V2 et 0 appel", async () => {
    for (const valeurs of [{}, { [PARAM_ENTREE_PHRASE]: true }, { [PARAM_PIECE_CLAUDE]: true }]) {
      const d = double();
      const port = await portsEquipeAvecPhrase(commande(), "v1", { executer: d.executer, lire: lecteur(valeurs) });
      const r = await courir(neuf(), port);
      expect(r.pause?.code).toBe("TO_CAS_V2");
      expect(d.appels).toHaveLength(0);
    }
  });

  it("les deux à `true` : 1 appel du maquettiste (étape « Tutoriel · maquettiste », plafond de V2-07), pause « à construire »", async () => {
    const d = double();
    const port = await portsEquipeAvecPhrase(commande(), "v1", { executer: d.executer, lire: lecteur(LES_DEUX) });
    expect(port.phraseOuverte).toBe(true);
    const r = await courir(neuf(), port);
    expect(d.appels).toHaveLength(1);
    expect(d.appels[0]).toEqual({ role: "maquettiste", etape: ETAPE_PIECE_TUTORIEL, plafond: plafondTutorielPhraseUsd() });
    expect(r.pause?.code).toBe("TO_PIECE_A_CONSTRUIRE");
    expect(r.e.pieceCreee?.statut).toBe("a-construire");
  });

  it("une vidéo partie d'un dossier garde le plafond d'aujourd'hui", async () => {
    const d = double();
    const dossier = { origine: undefined, entrees: { tutorielOutil: { depot: { mode: "dossier", fichierId: "f1", attestationImages: true } } } } as unknown as Pick<CommandeFabrication, "origine" | "entrees">;
    const port = await portsEquipeAvecPhrase(dossier, "v1", { executer: d.executer, lire: lecteur(LES_DEUX) });
    await port.appelerRole("chef-de-projet", { contexte: {}, variable: "{}" });
    const { plafondTutorielParDefautUsd } = await import("@/services/tutoriel-claude");
    expect(d.appels[0]?.plafond).toBe(plafondTutorielParDefautUsd());
  });

  it("« Réessayer » (le pas rejoué) : toujours 1 appel payé", async () => {
    const d = double();
    const port = await portsEquipeAvecPhrase(commande(), "v1", { executer: d.executer, lire: lecteur(LES_DEUX) });
    const premier = await courir(neuf(), port);
    expect(d.appels).toHaveLength(1);
    // Coupure juste après le paiement : l'état garde le registre des appels payés, pas la pièce.
    const { pieceCreee: _p, ...sansPiece } = premier.e;
    void _p;
    const rejoue = await courir({ ...sansPiece, appels: undefined }, port);
    expect(d.appels).toHaveLength(1);
    expect(rejoue.pause?.code).toBe("TO_PIECE_A_CONSTRUIRE");
    // Et la pause elle-même, rejouée, ne rappelle personne.
    await courir(rejoue.e, port);
    expect(d.appels).toHaveLength(1);
  });

  it("aperçu déposé puis pièce gardée : l'écran de validation du script, sans l'analyste ; les textes entrent au registre une fois gardée", async () => {
    const d = double();
    const port = await portsEquipeAvecPhrase(commande(), "v1", { executer: d.executer, lire: lecteur(LES_DEUX) });
    const avant = await courir(neuf(), port);
    expect(avant.e.registre).toBeUndefined();
    expect(avant.e.textesMaquette).toBeUndefined();
    // Le faux scénariste tient dans la durée cible à deux moments : la fiche du stratège est ramenée à deux moments.
    const sc = (e: EtatEquipe) => fauxScenariste({ moments: (e.fiche?.moments ?? []).slice(0, 2) });
    const e0 = apercuGarde(avant.e);
    const suite = await courir(e0, port, sc, true);
    expect(d.appels.map((a) => a.role).every((r) => ["maquettiste", "stratege", "scenariste"].includes(r))).toBe(true);
    expect(d.appels.map((a) => a.role)).not.toContain("analyste");
    expect(d.appels.map((a) => a.role)).not.toContain("chef-de-projet");
    expect(suite.pause?.code).toBe("TO_SCRIPT_A_VALIDER");
    const textes = suite.e.registre?.entrees.filter((x) => x.ou === "maquette") ?? [];
    expect(textes.length).toBeGreaterThan(0);
    expect(textes.every((x) => x.origine === "maquette-creee" && x.choisi === true)).toBe(true);
  });

  it("une pièce changée après le « oui » : retour à « à construire », rien n'est filmé", async () => {
    const d = double();
    const port = await portsEquipeAvecPhrase(commande(), "v1", { executer: d.executer, lire: lecteur(LES_DEUX) });
    const avant = await courir(neuf(), port);
    const gardee = apercuGarde(avant.e);
    const changee = { ...gardee, pieceCreee: { ...gardee.pieceCreee!, empreinte: "autre" } };
    const r = await courir(changee, port);
    expect(r.pause?.code).toBe("TO_PIECE_A_CONSTRUIRE");
    expect(r.e.carte).toBeUndefined();
  });
});
