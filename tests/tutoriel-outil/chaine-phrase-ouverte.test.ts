/**
 * CORR-V2-10-1 · la chaîne lit l'option « phrase ouverte » du port de l'équipe et la passe à `prochainPas`.
 * Doubles seulement : un port d'équipe qui compte ses appels, aucun Claude, aucune voix, aucun rendu, aucun réseau. 0 €.
 * Seul le booléen exact `true` ouvre la création ; tout le reste fait ce que la chaîne faisait avant.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil, type EtatTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { prochainPasPaye, type PortEquipe } from "@/moteurs/montage-tutoriel-outil/chaine";
import { ENTREE_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/entrees";
import type { IdRole } from "@/moteurs/montage-tutoriel-outil/journal-roles";
import { equipeAvecReleve } from "@/services/tutoriel-branchements";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";
import { dossierComplet } from "./equipe-doubles";

const T0 = Date.UTC(2026, 10, 21, 9);
const PHRASE = "un tableau de bord pour un atelier";

const commandePhrase = (): CommandeFabrication => commandeTutoriel({ ratios: ["4:5"], script: { blocs: [], texteComplet: "" }, entrees: { [ENTREE_TUTORIEL]: { depot: { mode: "phrase", phrase: PHRASE } } } } as never);
const commandeDossierDepose = (): CommandeFabrication => commandeTutoriel({ ratios: ["4:5"], script: { blocs: [], texteComplet: "" }, entrees: { [ENTREE_TUTORIEL]: { depot: { mode: "dossier", fichierId: "f-1", attestationImages: true } } } } as never);

/** Port double : compte chaque appel de rôle, ne rend jamais de réponse réelle (le maquettiste rend une pièce vide, refusée plus loin). */
function portDouble(plus: Record<string, unknown> = {}) {
  const appels: IdRole[] = [];
  let dossiers = 0;
  const port = {
    maintenant: () => new Date(T0).toISOString(),
    async appelerRole(role: IdRole) {
      appels.push(role);
      return { illisible: true };
    },
    async lireDossier() {
      dossiers++;
      return dossierComplet();
    },
    ...plus,
  } as PortEquipe;
  return { port, appels, dossiersLus: () => dossiers };
}

const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
const moteurAvec = (port: PortEquipe) => creerMoteurTutorielOutil({ outils: une({ ...outilsDoubles(journalVide()), equipe: port } as OutilsTutoriel) });

/** Mène jusqu'à une pause, un échec ou la fin (au plus quelques pas : le pas qui paie rend la main tout de suite). */
async function mener(port: PortEquipe, c: CommandeFabrication, pasMax = 12) {
  const m = moteurAvec(port);
  let t: Travail = await m.lancer(c, { travailId: "t-ph", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  for (let i = 0; i < pasMax; i++) {
    t = (await m.avancer(t, c, T0 + i * 1000)).travail;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return { travail: t, code: (t.parametres?.pause as { code?: string } | undefined)?.code, etat: t.parametres?.tutoriel as EtatTutoriel };
}

/** L'état après le pas gratuit du chef de projet (le premier pas payant est le suivant). Le port de cette étape ne paie rien. */
async function etatApresLeChef(c: CommandeFabrication, phraseOuverte: unknown): Promise<EtatTutoriel> {
  const eq = portDouble({ phraseOuverte });
  const m = moteurAvec(eq.port);
  const t = await m.lancer(c, { travailId: "t-ph", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  const suite = (await m.avancer(t, c, T0 + 1000)).travail;
  expect(eq.appels).toEqual([]);
  return suite.parametres!.tutoriel as EtatTutoriel;
}

describe("CORR-V2-10-1 · phrase ouverte lue par la chaîne", () => {
  it("phraseOuverte: true, dépôt « phrase » : le maquettiste est appelé ; réponse illisible = une reprise (PHRASE-1), puis pause, jamais un 3e appel", async () => {
    const eq = portDouble({ phraseOuverte: true });
    const { code } = await mener(eq.port, commandePhrase());
    expect(eq.appels).toEqual(["maquettiste", "maquettiste"]);
    expect(code).not.toBe("TO_CAS_V2");
    expect(code).toBe("TO_EQUIPE_BLOQUEE");
  });

  it("phraseOuverte: true : `prochainPasPaye` rend true (le pas réel paiera le maquettiste : le devis le réserve)", async () => {
    const c = commandePhrase();
    const eq = portDouble({ phraseOuverte: true });
    const outils = { ...outilsDoubles(journalVide()), equipe: eq.port } as OutilsTutoriel;
    expect(await prochainPasPaye(await etatApresLeChef(c, true), c, outils)).toBe(true);
    expect(eq.appels).toEqual([]); // la question ne paie jamais
  });

  it.each([
    ["absent", {}],
    ["false", { phraseOuverte: false }],
    ["« true » (texte)", { phraseOuverte: "true" as never }],
    ["1", { phraseOuverte: 1 as never }],
  ])("phraseOuverte %s : pause « création pas ouverte » d'aujourd'hui (TO_CAS_V2), 0 appel, `prochainPasPaye` rend false", async (_nom, plus) => {
    const eq = portDouble(plus);
    const { code } = await mener(eq.port, commandePhrase());
    expect(code).toBe("TO_CAS_V2");
    expect(eq.appels).toEqual([]);
    const c = commandePhrase();
    expect(await prochainPasPaye(await etatApresLeChef(c, true), c, { ...outilsDoubles(journalVide()), equipe: eq.port } as OutilsTutoriel)).toBe(false);
  });

  it("vidéo partie d'un dossier : `phraseOuverte: true` ne change rien (mêmes appels, même pause, jamais de maquettiste en plus)", async () => {
    const avec = portDouble({ phraseOuverte: true });
    const sans = portDouble({ phraseOuverte: false });
    const a = await mener(avec.port, commandeDossierDepose());
    const b = await mener(sans.port, commandeDossierDepose());
    expect(avec.appels).toEqual(sans.appels);
    expect(a.code).toBe(b.code);
    expect(avec.appels).not.toContain("maquettiste");
  });
});

describe("CORR-V2-10-1 · `equipeAvecReleve` garde le champ", () => {
  it("le port recopié porte toujours `phraseOuverte`, vrai comme faux", () => {
    const { port } = portDouble();
    expect(equipeAvecReleve({ ...port, phraseOuverte: true }).phraseOuverte).toBe(true);
    expect(equipeAvecReleve({ ...port, phraseOuverte: false }).phraseOuverte).toBe(false);
    expect(equipeAvecReleve(port).phraseOuverte).toBeUndefined();
  });
});
