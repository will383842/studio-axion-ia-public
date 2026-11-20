/**
 * L5-09 · file « À corriger » du calendrier (D6-23). Lecture seule et pure : aucune écriture, aucun appel au diffuseur.
 * Elle range les envois qui n'ont pas abouti et dit, pour chacun, ce qui est permis (jamais un envoi d'ici).
 */
import { occupeBuffer } from "@/domaine/buffer";
import { outilDe } from "@/domaine/outil-publication";
import { estRapatriee, type IdReseau, type Publication } from "@/domaine/types";

/** Libellés visibles (les noms de fichiers et de statuts internes ne changent pas). */
export const LIBELLE_A_CORRIGER = "À corriger";
export const LIBELLE_MES_TEXTES = "Mes textes";

/** Nombre d'essais permis après le premier échec net : un seul. */
export const ESSAIS_APRES_ECHEC = 1;

/** reessayer = un seul nouvel essai possible ; relire = relecture seule chez le diffuseur ; a-la-main = rien ne repart d'ici. */
export type ActionACorriger = "reessayer" | "relire" | "a-la-main";

export interface LigneACorriger {
  publicationId: string;
  reseau: IdReseau;
  date: string;
  etat: "refuse" | "a-verifier" | "absent";
  action: ActionACorriger;
  /** Phrase en clair, au vouvoiement. */
  phrase: string;
}

type PubFile = Pick<Publication, "id" | "videoId" | "visuelId" | "canalId" | "reseau" | "via" | "statut" | "etatEnvoi" | "date" | "cleEnvoi" | "modifieLe"> & Partial<Pick<Publication, "rapatrieeLe">>;

/** Combien de fois cet envoi (même clé) a déjà été tenté, toutes issues confondues. */
export function nombreEssais(publications: readonly Pick<Publication, "cleEnvoi">[], cleEnvoi: string | undefined): number {
  return cleEnvoi ? publications.filter((p) => p.cleEnvoi === cleEnvoi).length : 1;
}

export function construireFileACorriger(publications: readonly PubFile[]): LigneACorriger[] {
  const groupes = new Map<string, PubFile[]>();
  for (const p of publications) {
    if (outilDe(p) !== "zernio") continue;
    // RAP-3 : une publication reprise du diffuseur n'a rien à renvoyer ni à reprogrammer depuis le Studio.
    if (estRapatriee(p)) continue;
    const cle = p.cleEnvoi ?? `sans-cle:${p.id}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), p]);
  }
  const file: LigneACorriger[] = [];
  for (const groupe of groupes.values()) {
    // Un envoi réussi ou en cours dans le groupe : rien à corriger.
    if (groupe.some((p) => p.etatEnvoi === "envoye" || p.etatEnvoi === "en-cours")) continue;
    const derniere = [...groupe].sort((a, b) => (a.modifieLe ?? "").localeCompare(b.modifieLe ?? "")).at(-1)!;
    const base = { publicationId: derniere.id, reseau: derniere.reseau, date: derniere.date };
    if (derniere.etatEnvoi === "a-verifier") {
      file.push({ ...base, etat: "a-verifier", action: "relire", phrase: "Le diffuseur n'a pas confirmé : le studio relit chez lui, il ne renverra rien." });
    } else if (derniere.etatEnvoi === "absent") {
      file.push({ ...base, etat: "absent", action: "a-la-main", phrase: "Rien n'a été reçu chez le diffuseur : vérifiez chez lui, rien ne repart tout seul." });
    } else if (derniere.etatEnvoi === "refuse") {
      // Le même contenu occupe déjà ce réseau et ce compte (autre date, autre clé) : rien à réessayer ici.
      const dejaParti = publications.some((x) => x.id !== derniere.id && outilDe(x) === "zernio" && x.cleEnvoi !== derniere.cleEnvoi && x.reseau === derniere.reseau && x.canalId === derniere.canalId && (x.visuelId ?? x.videoId) === (derniere.visuelId ?? derniere.videoId) && occupeBuffer(x));
      if (dejaParti) continue;
      const essais = nombreEssais(groupe, derniere.cleEnvoi);
      file.push(
        essais <= ESSAIS_APRES_ECHEC
          ? { ...base, etat: "refuse", action: "reessayer", phrase: "L'envoi a été refusé : vous pouvez demander un seul nouvel essai." }
          : { ...base, etat: "refuse", action: "a-la-main", phrase: "Le nouvel essai a aussi échoué : corrigez le contenu ou le créneau, rien ne repart tout seul." },
      );
    }
  }
  return file.sort((a, b) => a.date.localeCompare(b.date));
}
