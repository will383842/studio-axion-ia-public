/**
 * R5 · vue serveur de l'écran « mots et cibles » (/mots). LECTURE SEULE : catalogue et liaisons du site (copie comprise), chiffres,
 * comptes, état des textes et garde d'envoi par compte. Aucun appel Zernio, aucune écriture. Les lignes du registre arrivent déjà
 * lues (`lireVueMots` n'est JAMAIS rappelé ici). Aucun mot ni guide écrit en dur : tout vient du registre et du catalogue du site.
 */
import "server-only";
import {
  cibleDuMot,
  PHRASES_REFUS_SITE,
  reseauSite,
  type ReseauSite,
} from "@/domaine/guide-reseau/cibles-contrat";
import { comptesParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { MOT_GUIDE } from "@/domaine/guide-reseau/empreinte-mot";
import {
  construireTableau,
  etatDuMot,
  type ApercuReseauVue,
  type ApercuTextesVue,
  type ChiffresMot,
  type CompteDuMot,
  type EtatValidationVue,
  type ReseauAutoVue,
  type ReseauCompte,
  type ResultatGesteVue,
  type ResumeMot,
  type VueMotsCibles,
} from "@/domaine/guide-reseau/vue-mots-cibles";
import type { StatsMotChiffrees } from "@/domaine/guide-reseau/stats-mots";
import { PHRASES_REFUS } from "@/components/mots/etat-mots";
import { lireCiblesSite } from "./cibles-site";
import type { LigneMot, Resultat } from "./mots-service";
import { apercuTextesMot, etatValidationMot, verifierMotPourCompte, type ApercuReseau } from "./mots-validation-par-mot";
import { motsMultiplesActifs } from "./parcours-mots-multiples";
import { lireStatsMots } from "./stats-mots";
import { comptesZernioEnregistres } from "./zernio";

const AUTO: readonly ReseauAutoVue[] = ["facebook", "instagram"];
const estAuto = (r: string | null): r is ReseauAutoVue => r === "facebook" || r === "instagram";

/** Une phrase pour un code de refus : phrases de l'écran, puis phrases du site, sinon une phrase simple. Jamais de détail technique. */
export function phraseDuCode(code: string): string {
  if (Object.hasOwn(PHRASES_REFUS, code)) return PHRASES_REFUS[code];
  if (Object.hasOwn(PHRASES_REFUS_SITE, code)) return PHRASES_REFUS_SITE[code];
  return "Demande refusée.";
}

/** Résultat d'un geste de service → ce que l'écran affiche. Un refus a toujours sa phrase. */
export function versResultatGeste(r: Resultat, phraseReussie: string): ResultatGesteVue {
  if (r.issue === "execute") return { issue: "execute", phrase: phraseReussie };
  return { issue: r.issue, phrase: phraseDuCode(r.raison) };
}

const versChiffres = (s: StatsMotChiffrees): ChiffresMot => ({
  ecrits: s.ecrits,
  envoyes: s.envoyes,
  incertains: s.incertains,
  suivent: s.suivent,
  commentairesBloques: s.commentairesBloques,
  envoisRefuses: s.envoisRefuses,
});

const reseauDuCompteVue = (reseauZernio: string | undefined): ReseauCompte | null => {
  const r = reseauZernio === undefined ? null : reseauSite(reseauZernio);
  return r === null || r === "tous" ? null : r;
};

/** Aperçu des textes : un élément par réseau automatique, le refus d'un réseau est une phrase simple. */
export function versApercuVue(reseaux: readonly ApercuReseau[]): ApercuTextesVue {
  const vus: ApercuReseauVue[] = reseaux.map((r) =>
    r.ok
      ? {
          reseau: r.reseau,
          ok: true,
          cible: { titre: r.cible.titre, type: r.cible.type, test: r.cible.test },
          textes: r.textes.map((t) => ({ groupe: t.groupe, version: t.version, texte: t.texte })),
          empreinte: r.empreinte,
          etat: r.etat,
        }
      : { reseau: r.reseau, ok: false, phrase: phraseDuCode(r.raison) },
  );
  return { ok: true, reseaux: vus };
}

export async function apercuVue(mot: string): Promise<ApercuTextesVue> {
  return versApercuVue(await apercuTextesMot({ mot }));
}

/** Pourquoi un compte ne peut pas (encore) activer ce mot ; `null` = rien ne l'empêche d'essayer (les gardes rejouent au clic). */
async function raisonDuCompte(o: { mot: string; compte: string; reseau: ReseauCompte | null; plusieurs: boolean }): Promise<string | null> {
  if (o.reseau === null) return "reseau_du_compte_inconnu";
  if (!estAuto(o.reseau)) return "reseau_a_la_main";
  // Le mot GUIDE a ses propres gardes (validation à part), rejouées par le geste d'activation.
  if (o.mot === MOT_GUIDE) return null;
  if (!o.plusieurs) return "plusieurs_mots_eteint";
  return verifierMotPourCompte({ mot: o.mot, compte: o.compte });
}

/**
 * Vue de l'écran. `null` si le catalogue du site est introuvable (ni site, ni copie récente) : l'écran actuel s'affiche seul.
 * `lignes` = lignes du registre déjà lues par la page.
 */
export async function lireVueMotsCibles({ lignes }: { lignes: readonly LigneMot[] }): Promise<VueMotsCibles | null> {
  const site = await lireCiblesSite();
  if (site === null) return null;
  const [stats, zernio, plusieurs] = await Promise.all([
    lireStatsMots().catch((): StatsMotChiffrees[] => []),
    comptesZernioEnregistres().catch(() => null),
    motsMultiplesActifs().catch(() => false),
  ]);
  const chiffresParMot: Record<string, ChiffresMot> = Object.fromEntries(stats.map((s) => [s.mot, versChiffres(s)]));
  const tableau = construireTableau({ catalogue: site.catalogue, liaisons: site.liaisons, ignores: site.ignores, chiffresParMot });
  const mots = [...new Set(tableau.lignes.map((l) => l.mot))];
  const idsComptes = comptesParcours();

  const resumes: ResumeMot[] = [];
  for (const mot of mots) {
    const comptes: CompteDuMot[] = [];
    for (const id of idsComptes) {
      const connu = zernio?.comptes.find((c) => c.id === id);
      const reseau = reseauDuCompteVue(connu?.reseau);
      const ligne = lignes.find((l) => l.mot === mot && l.compte === id);
      const raison = await raisonDuCompte({ mot, compte: id, reseau, plusieurs });
      comptes.push({
        compte: id,
        nom: connu?.nom ?? null,
        reseau,
        etat: ligne?.etat ?? "non_pose",
        surZernio: !!ligne?.idWorkflow,
        activable: raison === null,
        raison,
      });
    }
    const validations = {} as Record<ReseauAutoVue, EtatValidationVue>;
    for (const r of AUTO) {
      const e = cibleDuMot(mot, r, site.liaisons, site.catalogue).element;
      validations[r] = e && e.actif && mot !== MOT_GUIDE ? await etatValidationMot({ mot, reseau: r, codeCible: e.code, titre: e.titre }) : "absente";
    }
    const codes = new Set(
      (["facebook", "instagram", "linkedin", "tiktok"] as ReseauSite[]).map((r) => cibleDuMot(mot, r, site.liaisons, site.catalogue).element?.code ?? null),
    );
    resumes.push({ mot, etat: etatDuMot(comptes), validations, comptes, cibleDiffere: codes.size > 1, chiffres: chiffresParMot[mot] ?? null });
  }
  return { tableau, catalogue: site.catalogue, mots: resumes, plusieursMotsAllume: plusieurs, depuisCopie: site.depuisCopie };
}
