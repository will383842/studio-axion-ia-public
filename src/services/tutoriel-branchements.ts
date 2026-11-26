/**
 * RACCORDS DU « TUTORIEL D'OUTIL » (lot I) : ce que les services branchent sur le moteur `montage-tutoriel-outil` (pur,
 * il n'importe jamais un service), sur le modèle de `tableau-branchements.ts`. Chargé pour son effet par la boucle de fond.
 *
 *  - VOIX, STOCKAGE, RENDU : les mêmes branchements réels que le tableau animé (`branchementsReels`, `tableau-outils.ts`) :
 *    voix prête du personnage (refusée avant toute dépense si ce n'est pas la voix HeyGen épinglée), stockage R2,
 *    `studio-rendu`. La voix passe par le budget du studio (`verifierEtReserverSelonOrigine`) juste avant sa lecture.
 *  - CLAUDE : relié par `tutoriel-claude.ts`, éteint par défaut (réglage propre au tutoriel). Éteint, l'appel lève (« pas encore
 *    relié ») : le plan de scènes retombe sur le plan de repli (réserve « À vérifier »), l'idée attend un script collé.
 *    Jamais d'échec. Allumé, l'appel passe par le chemin gardé de l'argent (`executerRolePourVideo`).
 *  - Rien n'est construit tant qu'un travail du tutoriel n'avance pas ; sans personnage ou sans rendu réel : `null`, le
 *    travail reste en pause claire.
 */
import { cleDepenseUsine } from "./cle-depense-usine";
import { appelClaudeTutoriel, claudeTutorielActif, regardTutorielActif } from "./tutoriel-claude";
import { creerRegardTutoriel } from "./tutoriel-regard";
import { equipeTutorielActive, portsEquipeAvecPhrase } from "./tutoriel-equipe";
import "server-only";
import { brancherServicesTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { lireAccordDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { estSansVoix, lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { ROLES_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { scriptRetenu } from "@/moteurs/montage-tutoriel-outil/script";
import type { PortEquipe } from "@/moteurs/montage-tutoriel-outil/chaine";
import { avecReleve } from "@/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";
import { relevePourStratege } from "@/moteurs/montage-tutoriel-outil/performance";
import { porteCapacite } from "@/briques/bibliotheque-video/moteur";
import { extraireCapturesVolet, type PortExtraction } from "./captures-volet-source";
import { copieDeRenduAvecVolet } from "./captures-volet-tutoriel";

/**
 * N-05-VOLET-g2 : le port du volet « avant / après » (réglage `tutoriel.voletAvantApres`, ÉTEINT par défaut). Posé SEULEMENT si la
 * valeur lue est exactement `true`, que la commande porte un film de navigation et que la bibliothèque, si elle est là, permet
 * `objet.ecran` (règle des deux portes). Sinon `undefined` : rien ne change. Extraction par NOTRE serveur (0 €), copie signée à l'envoi.
 */
export function portVoletTutoriel(valeur: unknown, entrees: unknown, deps: { extraire: PortExtraction; cle: (nom: string) => string }): OutilsTutoriel["volet"] | undefined {
  if (valeur !== true || !lireEntreesTutoriel(entrees as Record<string, unknown> | undefined).navigationFilmee) return undefined;
  const porte = porteCapacite(entrees, "objet.ecran");
  if (porte.bibliotheque && !porte.permis) return undefined;
  return {
    captures: ({ idTravail, entrees: e, deja }) => extraireCapturesVolet(lireEntreesTutoriel(e), deja, { extraire: deps.extraire, idTravail, cle: deps.cle }),
    copieDeRendu: (plan, projet, signer) => copieDeRenduAvecVolet(plan, projet, { signer }),
  };
}

/** T-EXT-52b : retouche sans tout refaire. ÉTEINT par défaut. */
export const PARAM_RETOUCHE_PARTIELLE_TUTORIEL = "tutoriel.retouchePartielle";

/** Vrai SEULEMENT si la valeur lue est exactement `true` (absente, `"true"`, `1`, lecture en échec : éteint). */
export async function retouchePartielleActive(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    return (await l<unknown>(PARAM_RETOUCHE_PARTIELLE_TUTORIEL, false)) === true;
  } catch {
    return false;
  }
}

/** T-EXT-48b : boucle de performance (le relevé des vidéos publiées entre dans l'entrée du stratège de valeur). ÉTEINT par défaut. */
export const PARAM_PERFORMANCE_TUTORIEL = "tutoriel.performance";

/** Vrai SEULEMENT si la valeur lue est exactement `true` (absente, `"true"`, `1`, lecture en échec : éteint). */
export async function performanceTutorielActive(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    return (await l<unknown>(PARAM_PERFORMANCE_TUTORIEL, false)) === true;
  } catch {
    return false;
  }
}

/** Relevé factuel lu en lecture seule (aucun appel payant, aucune écriture) ; aucune ligne si rien n'est lisible. */
async function releveReel(): Promise<string[]> {
  return relevePourStratege(await (await import("./tutoriel-performance")).lirePerformanceTutoriel());
}

/**
 * T-EXT-48b : le port de l'équipe, où SEUL l'appel du stratège reçoit le relevé en contexte, et seulement si le réglage vaut
 * exactement `true`. Éteint, relevé vide ou lecture en échec : l'entrée reçue est passée telle quelle (même objet). Le réglage
 * et le relevé ne sont lus qu'au moment de cet appel. Le relevé n'écrit jamais une phrase de la vidéo.
 */
export function equipeAvecReleve(port: PortEquipe, deps: { active?: () => Promise<boolean>; releve?: () => Promise<readonly string[]> } = {}): PortEquipe {
  return {
    ...port,
    appelerRole: async (role, entree) => {
      if (role !== "stratege") return port.appelerRole(role, entree);
      let lignes: readonly string[] = [];
      try {
        if ((await (deps.active ?? performanceTutorielActive)()) === true) lignes = await (deps.releve ?? releveReel)();
      } catch {
        lignes = [];
      }
      return port.appelerRole(role, avecReleve(entree, lignes));
    },
  };
}

brancherServicesTutoriel({
  outils: async (c, travailId): Promise<OutilsTutoriel | null> => {
    // T-EXT-SV : mode sans voix = ni personnage ni voix ; seuls le rendu et le stockage sont reliés (0 appel HeyGen, 0 €).
    const sansVoix = estSansVoix(c.entrees);
    const personnageId = c.distribution[0]?.personnageId;
    if (!personnageId && !sansVoix) return null;
    const { branchementsReels, TARIF_VOIX_CENTIMES_PAR_CARACTERE } = await import("./tableau-outils");
    const { verifierEtReserverSelonOrigine } = await import("./credits");
    const { centimes } = await import("@/lib/montants");
    const { ErreurClaude } = await import("@/fournisseurs/claude/client");
    let b: Pick<Awaited<ReturnType<typeof branchementsReels>>, "env" | "montage"> & { voix?: Awaited<ReturnType<typeof branchementsReels>>["voix"] };
    try {
      b = sansVoix ? await (await import("./tableau-outils")).branchementsReelsSansVoix(c.videoId) : await branchementsReels(personnageId!, c.videoId);
    } catch {
      // Rendu, stockage ou voix pas reliés : pause claire (le moteur le dit), rien n'est dépensé.
      return null;
    }
    // Style de la Bibliothèque choisi pour la vidéo : transmis au moteur (champs absents si non définis).
    const style = c.styles.sousTitres?.valeur;
    // T-EXT-31 : mixage, mesure du son et vignette. Réglage absent ou autre que `true` = éteint.
    const { lireParametre } = await import("./_commun");
    const finitions = (await lireParametre<boolean>("tutoriel.finitions", false)) === true;
    // T-EXT-26a : fin commune (« Aucune » par défaut, « Prendre rendez-vous » si choisie). Seul `true` exact allume ; éteint, `fin` est absent.
    const finCommune = (await lireParametre<boolean>("tutoriel.finCommune", false)) === true;
    // T-EXT-42 : devis et plafond par vidéo, en quantités, montrés avant toute dépense. Seul `true` exact allume ; éteint, `devis` est absent.
    const devis = (await lireParametre<boolean>("tutoriel.devisAvantDepense", false)) === true;
    const idee = "aEcrire" in scriptRetenu(c.script.texteComplet, lireEntreesTutoriel(c.entrees));
    const rendu: NonNullable<OutilsTutoriel["rendu"]> = {
      service: () => b.montage.rendu(),
      signer: async (lectures, depot) => {
        const s = await b.montage.signer(lectures, [depot]);
        return { lectures: s.lectures, urlDepot: s.depots[depot.cle] };
      },
      cle: (nom) => `studio/${b.env}/videos/${c.videoId}/${nom}`,
    };
    // T-EXT-27b : le regard de Claude sur les images-clés. Éteint (champ absent) sans `tutoriel.regardeur` ET `tutoriel.claude` à `true`.
    const regarder = (await regardTutorielActif()) ? creerRegardTutoriel({ videoId: c.videoId, origine: c.origine, rendu }) : undefined;
    const voixReelle = sansVoix ? undefined : b.voix;
    // T-EXT-55 : l'équipe de rôles (T-EXT-48b : l'appel du stratège reçoit le relevé si `tutoriel.performance` vaut `true`). Éteinte (champ absent) sans `tutoriel.equipe` ET `tutoriel.claude` à `true`.
    const equipe = (await equipeTutorielActive()) ? equipeAvecReleve(await portsEquipeAvecPhrase(c, c.videoId)) : undefined;
    // N-05-VOLET-g2 : les 2 images tirées du film par l'étape `images` de `studio-aligneur` (modèle : regardeur-tableau.ts). Éteint : champ absent.
    const extraire: PortExtraction = async (d) => {
      const facecam = (await import("@/fournisseurs/facecam")).fournisseurFacecam({ reel: true });
      let e = await facecam.suivre("image", d.idTravail);
      if (e.statut === "echec" && e.erreur.travailInconnu) {
        const s = await b.montage.signer({ source: d.source }, Object.values(d.cles).map((cle) => ({ cle, mime: "image/jpeg" })));
        const depots = Object.fromEntries(Object.entries(d.cles).map(([nom, cle]) => [nom, s.depots[cle] ?? ""]));
        e = await facecam.soumettre("image", { idTravail: d.idTravail, source: s.lectures.source ?? "", depots, parametres: { etape: "images", instants: d.instants, largeur: d.largeur, cles: d.cles } });
      }
      if (e.statut === "en_file" || e.statut === "en_cours") return { statut: "en-cours" };
      if (e.statut === "echec") throw new Error(e.erreur.message);
      const liste = (e.resultat as unknown as { images?: unknown } | null)?.images;
      const images = (Array.isArray(liste) ? liste : []).flatMap((x: { nom?: unknown; cle?: unknown } | null) => (typeof x?.nom === "string" && typeof x.cle === "string" && d.cles[x.nom] === x.cle ? [{ nom: x.nom, cle: x.cle }] : []));
      return { statut: "fini", images };
    };
    const portVolet = portVoletTutoriel(await lireParametre<unknown>("tutoriel.voletAvantApres", false), c.entrees, { extraire, cle: rendu.cle });
    return {
      ...(devis
        ? {
            devis: {
              // Rôles appelés par la chaîne : plan (2 essais) et, équipe allumée, chaque rôle de l'équipe (ses essais, `ROLES_TUTORIEL`).
              roles: [...(equipe ? ROLES_TUTORIEL.filter((r) => r.essaisMax > 0).map((r) => ({ id: r.id, essaisMax: r.essaisMax })) : idee ? [{ id: "script", essaisMax: 1 }] : []), { id: "plan", essaisMax: 2 }],
              accord: lireAccordDevis(c.entrees),
              consomme: async (etat) => ({
                appelsClaude: (etat.appelsClaude?.script ?? 0) + (etat.appelsClaude?.plan ?? 0) + Object.values(etat.appelsClaude?.roles ?? {}).reduce((s, n) => s + n, 0),
                caracteresVoix: etat.audio && !etat.audio.reutilise ? etat.audio.caracteres : 0,
                rendus: etat.rendus.length,
              }),
            },
          }
        : {}),
      ...(finitions ? { finitions: { actif: true as const } } : {}),
      ...((await retouchePartielleActive()) ? { retouchePartielle: true } : {}),
      ...(finCommune ? { fin: { actif: true } } : {}),
      sousTitres: { ...(style ? { style } : {}), ...(c.sousTitres?.base ? { base: c.sousTitres.base } : {}), ...(c.sousTitres?.intensite ? { intensite: c.sousTitres.intensite } : {}) },
      ...(voixReelle ? { voix: {
        ...voixReelle,
        avantLecture: async (l: { caracteres: number; lecturesMax: number }) => {
          // FIX-VOIX-TUTO : le texte RÉELLEMENT lu. Studio : la réservation unique du travail couvre toutes les lectures permises (comme le devis) ; Usine : clé neuve à chaque lecture (déjà cumulée).
          const caracteres = l.caracteres;
          const lectures = (await import("./autonomie-usine")).normaliserOrigine(c.origine) === "usine" ? 1 : l.lecturesMax;
          const total = centimes(Math.ceil(caracteres * lectures * TARIF_VOIX_CENTIMES_PAR_CARACTERE));
          await verifierEtReserverSelonOrigine(c.origine, { lignes: [{ etape: "voix", fournisseur: voixReelle.fournisseurVoix ?? "heygen", unite: "caractere", quantite: caracteres * lectures, prixUnitaire: centimes(TARIF_VOIX_CENTIMES_PAR_CARACTERE), total, nature: "estime" }], total }, total.centimes, "Cette vidéo", { videoId: c.videoId, travailId, ...cleDepenseUsine(c.origine, travailId) });
        },
      } } : {}),
      claude: (await claudeTutorielActif())
        ? appelClaudeTutoriel(c.videoId, c.origine)
        : async () => {
            throw new ErreurClaude("requete", "Claude n'est pas encore relié au tutoriel d'outil.");
          },
      ...(regarder ? { regarder } : {}),
      ...(equipe ? { equipe } : {}),
      ...(portVolet ? { volet: portVolet } : {}),
      rendu,
    };
  },
});
