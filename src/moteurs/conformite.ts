/**
 * CONFORMITÉ DE TOUS LES MOTEURS (G1-02) : `testerGenerateur(moteur, fabriquerCommande, options)`.
 *
 * Aide de TEST, jamais importée par le code de production ni par `studio-rendu` (`src/moteurs/` n'est pas copié par
 * l'image du rendu). Elle RÉUTILISE `testerMoteurVideo` (contrat actuel, `contrat.ts` inchangé) et ajoute ce que le
 * contrat ne dit pas : pause sans fournisseur, retouche partielle, ratios du format, origine « usine », sortie conforme
 * (résolution, durée, clé `/demo/`, doublons, réseaux, durée maximale du réseau). Elle ne refait ni `en_cours` ni le
 * redémarrage (déjà testés). Doubles seulement : aucun fournisseur, aucun appel à Claude, aucune dépense.
 *
 * Les manques de l'existant sont des EXCEPTIONS DATÉES, écrites en dur dans le test (« moteur, contrôle, 15/11/2026 ») ;
 * un moteur neuf n'en a aucune. Accroche de N-07 (zone sûre dans les 4 formats) : `controlesEnPlus`, vide par défaut.
 * À appeler depuis un fichier *.test.ts (dépend de vitest).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Ratio, Travail } from "@/domaine/types";
import { trouverFormat } from "@/formats";
import { listerReseaux } from "@/reseaux";
import { fichierDejaFait } from "@/reseaux/sorties";
import { testerMoteurVideo } from "./contrat";
import type { MoteurVideo, ResultatFabrication, SortieProduite } from "./types";

export type ControleConformite =
  | "contrat-commun"
  | "pause-sans-fournisseur"
  | "retouche-partielle"
  | "ratios-du-format"
  | "origine-usine"
  | "sortie-conforme";

/** Un manque connu de l'existant : daté, motivé, jamais ajouté pour un moteur neuf. */
export interface ExceptionConformite {
  moteur: string;
  controle: ControleConformite;
  /** « JJ/MM/AAAA ». */
  date: string;
  motif: string;
}

export interface OptionsConformite {
  /** Format sans prix (comme `testerMoteurVideo`). */
  sansPrix?: boolean;
  /** Exceptions datées de CE moteur (celles d'autres moteurs sont ignorées). */
  exceptions?: ExceptionConformite[];
  /**
   * Même moteur, branché sur AUCUN fournisseur (outils absents) : la fabrication doit se mettre en pause, jamais
   * échouer, jamais rendre une vidéo d'essai. Absent : le contrôle est une exception à déclarer.
   */
  moteurSansFournisseur?: () => MoteurVideo;
  /** Accroche de N-07 (zone sûre dans les 4 formats) : chaque contrôle rend la liste des défauts d'une sortie. Vide par défaut. */
  controlesEnPlus?: ((sortie: SortieProduite) => string[])[];
}

const T0 = Date.UTC(2026, 10, 15, 9, 0, 0);

/** Mène un travail jusqu'à son terme (doubles : l'horloge est simulée, aucune attente réelle). */
async function mener(moteur: MoteurVideo, commande: CommandeFabrication, id: string): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let travail = await moteur.lancer(commande, { travailId: id, versionId: `ver-${id}`, titre: "Conformité", maintenant: T0 });
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, commande, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") break;
  }
  return { travail, resultat };
}

function lireRatio(ratio: Ratio): number {
  const [l, h] = ratio.split(":").map(Number);
  return l / h;
}

/** Défauts d'UNE sortie, sans regarder les autres (pure : testable sur un moteur factice). */
export function defautsDeSortie(sortie: SortieProduite, options: { simulation?: boolean; controlesEnPlus?: OptionsConformite["controlesEnPlus"] } = {}): string[] {
  const defauts: string[] = [];
  const m = /^(\d+)x(\d+)$/.exec(sortie.resolution ?? "");
  if (!m) defauts.push(`résolution « ${sortie.resolution} » : format LxH attendu`);
  else if (Math.abs(Number(m[1]) / Number(m[2]) - lireRatio(sortie.ratio)) > 0.01) defauts.push(`résolution ${sortie.resolution} incohérente avec le ratio ${sortie.ratio}`);
  if (!(sortie.dureeSec > 0)) defauts.push(`durée ${sortie.dureeSec} : doit être > 0`);
  if (!options.simulation) {
    for (const cle of [sortie.fichierCle, sortie.vignetteCle]) if (cle?.includes("/demo/")) defauts.push(`clé « ${cle} » : vidéo de démonstration hors simulation`);
  }
  const connus = listerReseaux();
  for (const id of sortie.reseaux ?? []) {
    const reseau = connus.find((r) => r.id === id);
    if (!reseau) defauts.push(`réseau « ${id} » inconnu`);
    else if (sortie.dureeSec > reseau.dureeMaxSec) defauts.push(`durée ${sortie.dureeSec} s > ${reseau.dureeMaxSec} s (maximum de ${reseau.id})`);
  }
  for (const controle of options.controlesEnPlus ?? []) defauts.push(...controle(sortie));
  return defauts;
}

/** Défauts de l'ensemble des sorties d'un résultat : chaque sortie, plus les doublons `fichierDejaFait`. */
export function defautsDeSorties(sorties: SortieProduite[], options: { simulation?: boolean; controlesEnPlus?: OptionsConformite["controlesEnPlus"] } = {}): string[] {
  const defauts: string[] = [];
  const faites: SortieProduite[] = [];
  for (const s of sorties) {
    defauts.push(...defautsDeSortie(s, options));
    if (fichierDejaFait(faites, s)) defauts.push(`sortie ${s.ratio} en double (fichierDejaFait)`);
    faites.push(s);
  }
  return defauts;
}

export function testerGenerateur(moteur: MoteurVideo, fabriquerCommande: () => Promise<CommandeFabrication>, options: OptionsConformite = {}) {
  const exception = (controle: ControleConformite) => (options.exceptions ?? []).find((e) => e.moteur === moteur.id && e.controle === controle);
  /** Un contrôle en exception est écrit en `skip` avec sa date : visible dans le rapport, jamais silencieux. */
  const controle = (nom: ControleConformite, libelle: string, corps: () => Promise<void> | void) => {
    const e = exception(nom);
    if (e) it.skip(`${libelle} — exception « ${e.moteur}, ${e.controle}, ${e.date} » : ${e.motif}`, corps);
    else it(libelle, corps);
  };

  const e0 = exception("contrat-commun");
  if (e0) describe.skip(`contrat MoteurVideo — ${moteur.id} — exception « ${e0.moteur}, ${e0.controle}, ${e0.date} » : ${e0.motif}`, () => it("contrat commun", () => {}));
  else testerMoteurVideo(moteur, fabriquerCommande, { sansPrix: options.sansPrix });

  describe(`conformité générateur — ${moteur.id}`, () => {
    const enSimulation = moteur.id === "simulation";

    controle("pause-sans-fournisseur", "sans fournisseur : le travail se met en pause, sans échec ni vidéo d'essai", async () => {
      expect(options.moteurSansFournisseur, "moteurSansFournisseur manquant").toBeDefined();
      const sans = options.moteurSansFournisseur!();
      const c = await fabriquerCommande();
      const travail = await sans.lancer(c, { travailId: "t-pause", versionId: "ver-pause", titre: "Pause", maintenant: T0 });
      expect(travail.statut).not.toBe("echec");
      let t = travail;
      let resultat: ResultatFabrication | undefined;
      for (let ms = T0; ms < T0 + 30_000; ms += 500) {
        const r = await sans.avancer(t, c, ms);
        t = r.travail;
        resultat = r.resultat ?? resultat;
      }
      expect(t.statut).not.toBe("echec");
      expect(t.statut).not.toBe("termine");
      expect(resultat).toBeUndefined();
    });

    controle("retouche-partielle", "une retouche partielle par opérations renvoie un travail exploitable (R-4)", async () => {
      const c = await fabriquerCommande();
      const planId = c.plans[0]?.id ?? "p";
      const t = await moteur.retoucher({
        commande: c,
        contexte: { travailId: "t-ret", versionId: "ver-ret", titre: "Retouche", maintenant: T0 },
        planIds: [planId],
        consigne: "Plus lent",
        operations: [{ type: "ajusterRythme", sens: "plus-lent" }],
      });
      expect(t.type).toBe("retouche");
      expect(t.cibleId).toBe(c.videoId);
      expect(t.id).toBe("t-ret");
      expect(Array.isArray(t.etapes)).toBe(true);
    });

    controle("ratios-du-format", "les ratios du moteur couvrent ceux de la fiche du format", async () => {
      const c = await fabriquerCommande();
      const format = trouverFormat(c.formatId);
      expect(format, `format « ${c.formatId} » introuvable`).toBeDefined();
      for (const r of format!.ratios) expect(moteur.capacites.ratios, `ratio ${r} du format absent des capacités`).toContain(r);
    });

    controle("origine-usine", "l'origine « usine » de la commande est conservée jusqu'au résultat", async () => {
      const c: CommandeFabrication = { ...(await fabriquerCommande()), origine: "usine" };
      const avant = JSON.stringify(c.origine);
      const { travail, resultat } = await mener(moteur, c, "t-usine");
      expect(travail.statut).toBe("termine");
      expect(resultat).toBeDefined();
      expect(c.origine).toBe("usine");
      expect(JSON.stringify(c.origine)).toBe(avant);
      const posee = (travail.parametres as { origine?: string } | undefined)?.origine;
      if (posee !== undefined) expect(posee).toBe("usine");
    });

    controle("sortie-conforme", "les sorties sont conformes (résolution, durée, clés, doublons, réseaux, durée max)", async () => {
      const c = await fabriquerCommande();
      const { travail, resultat } = await mener(moteur, c, "t-sortie");
      expect(travail.statut).toBe("termine");
      expect(resultat).toBeDefined();
      expect(defautsDeSorties(resultat!.sorties, { simulation: enSimulation || c.moteurId === "simulation", controlesEnPlus: options.controlesEnPlus })).toEqual([]);
    });
  });
}
