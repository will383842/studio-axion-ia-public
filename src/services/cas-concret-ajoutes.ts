/**
 * AJOUTER UN CAS (décision de Will du 24/10/2026). SERVEUR UNIQUEMENT. Le cas est construit et contrôlé par le CODE
 * (`montage-cas-concret/cas-ajoutes.ts`, pur), puis rangé dans le réglage durable `casConcret.casAjoutes` : un cas
 * PERSISTANT qui apparaît dans « À faire » avec les autres, que Will peut retirer et dont il peut fournir le script.
 *
 * Argent : ajouter un cas ne dépense rien et ne contourne rien. Il n'est lu que par `trouverCasAutorise`, donc passe par les
 * mêmes contrôles avant le prix que les cas du catalogue (déjà traité, retiré, validé, mot pris…). Il n'est « validé » que si
 * Will le dit (case cochée par défaut dans le formulaire) : l'empreinte validée est celle du cas, jamais `valideParWill`.
 */
import "server-only";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { empreinteCas } from "@/formats/cas-concret/cas";
import { FORMULAIRE_MAX_CARACTERES, idCasAjoute, preparerCasAjoute, ressemblances, type FormulaireCas } from "@/moteurs/montage-cas-concret/cas-ajoutes";
import { controlerTexteFourni, TEXTE_FOURNI_MAX } from "@/moteurs/montage-cas-concret/script-fourni";
import { creerVerrou, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { CAS_AJOUTES_MAX, CLE_CAS_AJOUTES, lireEntreesCasAjoutes, type EntreeCasAjoute } from "./cas-concret-ajoutes-lecture";

export { CAS_AJOUTES_MAX, CLE_CAS_AJOUTES };

/** Réglage des validations de Will (par empreinte), le même que `cas-concret.ts`. */
export const CLE_VALIDATIONS_CAS = "casConcret.validations";

const verrou = creerVerrou();

export interface ApercuAjout {
  ok: boolean;
  /** Une phrase par problème, chacune précédée de son champ. */
  raisons: string[];
  /** Cas qui RESSEMBLENT à celui-ci : un avertissement, jamais un blocage. */
  ressemblances: { id: string; titre: string }[];
}

function borner(formulaire: unknown, script: unknown): string | null {
  if (!formulaire || typeof formulaire !== "object" || Array.isArray(formulaire)) return "Le formulaire est vide ou illisible.";
  let taille = 0;
  try {
    taille = JSON.stringify(formulaire).length;
  } catch {
    return "Le formulaire est illisible.";
  }
  if (taille > FORMULAIRE_MAX_CARACTERES) return `Le formulaire est trop long (${FORMULAIRE_MAX_CARACTERES} caractères au plus).`;
  if (script !== undefined && script !== null && (typeof script !== "string" || script.length > TEXTE_FOURNI_MAX)) return `Le script est trop long (${TEXTE_FOURNI_MAX} caractères au plus).`;
  return null;
}

async function motsInterdits(): Promise<string[]> {
  return (await import("./cas-concret-scripts")).motsInterditsDeWill();
}

/** Contrôle GRATUIT (aucune écriture) : les refus en phrases, et les cas qui ressemblent. */
export async function controlerCasAjoute(formulaire: unknown, script?: string | null): Promise<ApercuAjout> {
  await exigerSession();
  const trop = borner(formulaire, script);
  if (trop) return { ok: false, raisons: [trop], ressemblances: [] };
  const ajoutes = Object.values(await lireEntreesCasAjoutes()).map((e) => e.cas);
  const autres = [...CATALOGUE, ...ajoutes];
  const r = preparerCasAjoute(formulaire, { id: "ajout-controle-0000", autres });
  const raisons = r.ok ? [] : [...r.raisons];
  if (r.ok && script && script.trim()) {
    const c = controlerTexteFourni(script, r.cas, { motsInterdits: await motsInterdits() });
    if (!c.ok) raisons.push(...c.refus.map((x) => `Mon script : ${x.message}`));
  }
  const f = r.formulaire;
  return { ok: raisons.length === 0, raisons, ressemblances: f ? ressemblances(f, autres) : [] };
}

/**
 * Ajoute le cas : contrôle, écriture sous verrou, validation si demandée, script fourni si donné. Un refus est une
 * `ErreurStudio` dont le message porte une raison par ligne ; rien n'est écrit. Rend l'identifiant du cas.
 */
export async function ajouterCas(formulaire: unknown, options: { valider?: boolean; script?: string | null } = {}): Promise<{ casId: string; titre: string; scriptEnregistre: boolean }> {
  await exigerSession();
  const script = typeof options.script === "string" && options.script.trim() ? options.script : null;
  const trop = borner(formulaire, script);
  if (trop) throw new ErreurStudio("CAS_AJOUT_REFUSE", trop);
  const interdits = script ? await motsInterdits() : [];
  const sortie = await verrou(async () => {
    const lus = await lireEntreesCasAjoutes();
    if (Object.keys(lus).length >= CAS_AJOUTES_MAX) throw new ErreurStudio("CAS_AJOUT_PLEIN", `Vous avez déjà ${CAS_AJOUTES_MAX} cas ajoutés : retirez-en avant d'en ajouter.`);
    const autres = [...CATALOGUE, ...Object.values(lus).map((e) => e.cas)];
    const id = idCasAjoute(typeof (formulaire as { theme?: unknown }).theme === "string" ? (formulaire as { theme: string }).theme : "", new Set(autres.map((c) => c.id)));
    const r = preparerCasAjoute(formulaire, { id, autres });
    if (!r.ok) throw new ErreurStudio("CAS_AJOUT_REFUSE", r.raisons.join("\n"));
    // Le script est contrôlé AVANT toute écriture : refusé, rien n'est écrit.
    if (script) {
      const c = controlerTexteFourni(script, r.cas, { motsInterdits: interdits });
      if (!c.ok) throw new ErreurStudio("SCRIPT_FOURNI_REFUSE", c.refus.map((x) => `Mon script : ${x.message}`).join("\n"));
    }
    const f = r.formulaire as FormulaireCas;
    const le = maintenant();
    const entree: EntreeCasAjoute = { cas: r.cas, ...(f.secteur ? { secteur: f.secteur } : {}), ...(f.taille ? { taille: f.taille } : {}), ajouteLe: le, historique: [{ version: r.cas.version, cas: r.cas, le }] };
    const brut = (await lireParametre<Record<string, unknown>>(CLE_CAS_AJOUTES, {})) ?? {};
    await ecrireParametre(CLE_CAS_AJOUTES, { ...brut, [id]: entree });
    if (options.valider !== false) {
      const validations = (await lireParametre<Record<string, unknown>>(CLE_VALIDATIONS_CAS, {})) ?? {};
      await ecrireParametre(CLE_VALIDATIONS_CAS, { ...validations, [id]: { empreinte: empreinteCas(r.cas), valideLe: le } });
    }
    await journaliser("cas-concret", `Cas ajouté : ${r.cas.titre}${options.valider !== false ? " (validé)" : " (à valider)"}`, { type: "cas-concret", id });
    return { casId: id, titre: r.cas.titre };
  });
  let scriptEnregistre = false;
  if (script) {
    const { enregistrerScriptFourni } = await import("./cas-concret-script-fourni");
    await enregistrerScriptFourni(sortie.casId, script);
    scriptEnregistre = true;
  }
  return { ...sortie, scriptEnregistre };
}
