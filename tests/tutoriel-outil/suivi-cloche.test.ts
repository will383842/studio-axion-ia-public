/**
 * T-EXT-34 · Cloche du suivi : dépôt mémoire, cloche en double (aucun téléphone, aucun e-mail), 0 €.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { EtapeTravail, Notification, Travail, TypeNotification, Video } from "@/domaine/types";
import { noterRole } from "@/moteurs/montage-tutoriel-outil/journal-roles";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { lienSuivi, signalerSuivi, type CreerCloche } from "@/services/tutoriel-suivi";

const VIDEO = "vid_t34";
const SCRIPT_SECRET = "Voici mes paroles privées de tutoriel.";
const T = "2026-11-18T09:00:00.000Z";
const TYPES_EXISTANTS: TypeNotification[] = ["video-prete", "echec", "plan-a-verifier", "visage-pret", "voix-prete", "budget", "publication", "info", "veille", "credit"];

let posees: Parameters<CreerCloche>[0][] = [];
const creer: CreerCloche = async (n) => {
  posees.push(n);
  await depots().notifications.enregistrer({ id: `not_${posees.length}`, lue: false, creeLe: T, modifieLe: T, ...n } as Notification);
};

const etape = (cle: string, statut: EtapeTravail["statut"]): EtapeTravail => ({ cle, nom: cle, icone: "film", dependDe: [], statut, progression: 0, sortieFichierIds: [] });
function travail(sur: Partial<Travail> = {}): Travail {
  return {
    id: "trv_t34",
    type: "fabrication",
    cibleId: VIDEO,
    titre: "Tutoriel",
    etapes: [etape("script", "en_cours")],
    statut: "en_cours",
    progression: 10,
    tentatives: 1,
    cleIdempotence: "k",
    fournisseurUtilise: "studio",
    creeLe: T,
    modifieLe: T,
    parametres: { tutoriel: { ratios: ["4:5"], rendus: [], reserves: [], proposition: SCRIPT_SECRET } },
    ...sur,
  } as Travail;
}
const enPause = (code: string) => travail({ statut: "en_file", parametres: { pause: { code, message: "x" }, tutoriel: { proposition: SCRIPT_SECRET } } });
const avecJournal = (role: "controleur" | "regardeur", etat: "a-revoir" | "fait", sur: Partial<Travail> = {}) =>
  travail({ ...sur, parametres: { tutoriel: noterRole({ ratios: ["4:5"], rendus: [], reserves: [] }, { role, etat, le: T }) } });

beforeEach(async () => {
  reinitialiserDepots();
  posees = [];
  await depots().videos.enregistrer({ id: VIDEO, titre: "Mon premier tableau de bord", creeLe: T, modifieLe: T } as Video);
});

const actif = { creer, actif: true };

describe("cloche du suivi de fabrication", () => {
  it("un rôle qui attend Williams : une notification « plan-a-verifier »", async () => {
    await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), actif);
    expect(posees).toHaveLength(1);
    expect(posees[0]).toMatchObject({ type: "plan-a-verifier", lien: lienSuivi(VIDEO) });
    expect(posees[0].titre).toContain("Votre tutoriel attend votre choix");
    expect(posees[0].message).toContain("Mon premier tableau de bord");
  });

  it("le même appel deux fois : toujours une seule notification", async () => {
    await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), actif);
    const encore = await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), actif);
    expect(encore).toEqual([]);
    expect(posees).toHaveLength(1);
    expect(await depots().notifications.lister((n) => n.lien === lienSuivi(VIDEO))).toHaveLength(1);
  });

  it("un autre rôle (ou une autre vidéo) qui attend : une autre notification", async () => {
    await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), actif);
    await signalerSuivi(enPause("TO_DEVIS_A_ACCEPTER"), actif);
    expect(posees).toHaveLength(2);
    expect(new Set(posees.map((n) => n.titre)).size).toBe(2);
  });

  it("un point à revoir (contrôleur ou regardeur) : une notification « plan-a-verifier »", async () => {
    await signalerSuivi(avecJournal("controleur", "a-revoir"), actif);
    expect(posees).toHaveLength(1);
    expect(posees[0]).toMatchObject({ type: "plan-a-verifier" });
    expect(posees[0].titre).toContain("Un point est à revoir avant de vous montrer la vidéo");
    await signalerSuivi(avecJournal("regardeur", "a-revoir"), actif);
    expect(posees).toHaveLength(2);
  });

  it("l'échec du travail : une notification « echec » avec le message lisible du moteur", async () => {
    const erreur = { code: "TO_X", reessayable: true, messagePourWill: "La voix n'a pas pu être lue : réessayez." };
    await signalerSuivi(travail({ statut: "echec", erreur }), actif);
    expect(posees).toHaveLength(1);
    expect(posees[0]).toMatchObject({ type: "echec" });
    expect(posees[0].message).toContain(erreur.messagePourWill);
  });

  it("terminé et proposable : « video-prete »", async () => {
    await signalerSuivi(travail({ statut: "termine" }), actif);
    expect(posees.map((n) => n.type)).toEqual(["video-prete"]);
  });

  it("terminé mais non proposable (point à revoir) : pas de « video-prete »", async () => {
    await signalerSuivi(avecJournal("controleur", "a-revoir", { statut: "termine" }), actif);
    expect(posees.map((n) => n.type)).toEqual(["plan-a-verifier"]);
  });

  it("les outils non reliés : aucune cloche", async () => {
    await signalerSuivi(enPause("TO_OUTILS_NON_RELIES"), actif);
    expect(posees).toEqual([]);
  });

  it("aucun type neuf, jamais le texte du script", async () => {
    await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), actif);
    await signalerSuivi(travail({ statut: "echec" }), actif);
    await signalerSuivi(travail({ statut: "termine" }), actif);
    expect(posees).toHaveLength(3);
    for (const n of posees) {
      expect(TYPES_EXISTANTS).toContain(n.type);
      expect(`${n.titre} ${n.message}`).not.toContain(SCRIPT_SECRET);
    }
  });

  it("allumé par défaut : sans réglage, une notification ; `true`, `1`, `oui` : posée ; `false` écrit : rien n'est posé", async () => {
    expect(await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), { creer })).toHaveLength(1);
    for (const v of ["true", 1, "oui"]) {
      const id = `vid_defaut_${String(v)}`;
      await depots().videos.enregistrer({ id, titre: "Autre", creeLe: T, modifieLe: T } as Video);
      await depots().parametres.enregistrer({ id: "tutoriel.suiviCloche", valeur: v, creeLe: T, modifieLe: T });
      expect(await signalerSuivi({ ...enPause("TO_SCRIPT_A_VALIDER"), cibleId: id }, { creer })).toHaveLength(1);
    }
    await depots().parametres.enregistrer({ id: "tutoriel.suiviCloche", valeur: false, creeLe: T, modifieLe: T });
    expect(await signalerSuivi(enPause("TO_SCRIPT_A_VALIDER"), { creer })).toEqual([]);
  });

  it("vidéo absente : rien n'est posé", async () => {
    await signalerSuivi(travail({ cibleId: "vid_absente", statut: "echec" }), actif);
    expect(posees).toEqual([]);
  });
});
