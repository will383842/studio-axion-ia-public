"use client";

/**
 * RELIRE LE SCRIPT AVANT LA VIDÉO, grande chaîne (briques 4 et 5) : l'écran commun `RelireScript` branché sur les
 * versions par réseau d'un sujet. Une version (« Fabriquer », « Relire et modifier ») ou les N (« Fabriquer les N »).
 * Contrôles en direct gratuits ; le lancement envoie le texte relu et son empreinte (repère « script relu »).
 * Socle qualité commun en OBSERVATION (comme le tableau) : pastilles « info » de la recette « Écrire » du format, sans
 * appel, sans effet sur les contrôles (règles de Will : « faites-le vous-même », annonce d'outil, interdits…).
 */
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { controlerRelectureAction, enregistrerRelectureAction, fabriquerApresRelectureAction } from "@/app/(studio)/ecrire/sujets/actions";
import { RelireScript } from "@/components/script/RelireScript";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { notifier } from "@/components/ui/Toast";
import { avecSecondOuiVoyant } from "@/domaine/voyant-rouge";
import { evaluerQualite } from "@/domaine/qualite-script";
import { depuisLignesEcrire } from "@/domaine/qualite-script/adaptateurs/ecrire";
import { recetteQualiteEcrire } from "@/domaine/qualite-script/recettes";
import type { LigneScript, PastilleControle, ResultatLancement, ScriptRelu } from "@/domaine/relecture-script";
import type { Ratio } from "@/domaine/types";

export interface ProprietesRelireVersions {
  sujetId: string;
  /** Absent : « Fabriquer les N ». */
  varianteId?: string;
  lignes: LigneScript[];
  debit?: number;
  /** Format du sujet : choisit la recette du socle qualité (observation). Absent ou sans recette : pas d'encadré. */
  formatId?: string;
  /** « modifier » : 0 €, enregistrer seulement ; « fabriquer » : lancer la vidéo après la confirmation du prix. */
  but: "modifier" | "fabriquer";
  prixCentimes: number;
  ratiosOption?: Ratio[];
}

export function RelireVersions({ sujetId, varianteId, lignes, debit, formatId, but, prixCentimes, ratiosOption }: ProprietesRelireVersions) {
  const router = useRouter();
  // Une opération par ouverture de l'écran : le double toucher et la confirmation du prix ne créent qu'une vidéo.
  const [operationId] = useState(() => `op-relu-${varianteId ?? "n"}-${Date.now().toString(36)}`);
  // Le oui au voyant, lié à CETTE opération : si le prix est redemandé puis relancé, la question n'est pas reposée.
  const ouiVoyant = useRef({ operationId, current: false });
  if (ouiVoyant.current.operationId !== operationId) ouiVoyant.current = { operationId, current: false };
  // Où aller après : la vidéo lancée, sinon la fiche du sujet (un ref : lu juste après `lancer`).
  const suite = useRef(`/ecrire/sujets/${sujetId}`);

  const observation = useMemo(() => {
    const recette = recetteQualiteEcrire(formatId);
    return recette ? (l: LigneScript[]) => evaluerQualite(depuisLignesEcrire(l), recette).pastilles : undefined;
  }, [formatId]);

  const controler = useCallback(
    async (s: ScriptRelu): Promise<PastilleControle[]> => {
      const r = await controlerRelectureAction(sujetId, varianteId ?? null, s.lignes);
      if (!r.ok) throw new Error(r.message);
      return r.donnees;
    },
    [sujetId, varianteId],
  );

  const lancer = useCallback(
    async (s: ScriptRelu, accord: number | true): Promise<ResultatLancement> => {
      if (but === "modifier") {
        if (!varianteId) return { ok: false, message: "Choisissez une version." };
        if (!s.modifications.length) return { ok: true };
        const r = await enregistrerRelectureAction(sujetId, varianteId, s.lignes);
        if (!r.ok) return { ok: false, message: r.message, code: r.code };
        notifier.succes("Modifications gardées, version à valider", r.donnees.phrase);
        return { ok: true };
      }
      // Voyant rouge : un second « oui » avant la voix payante (une seule question), gardé par le serveur.
      const r = await avecSecondOuiVoyant(
        (malgreVoyant) => fabriquerApresRelectureAction(sujetId, varianteId ?? null, { lignes: s.lignes, empreinte: s.empreinte, operationId, accord, ratiosOption, malgreVoyant }),
        async (question) => (await confirmerPrix({ message: question })) !== null,
        ouiVoyant.current,
      );
      if (!r.ok) return { ok: false, message: r.code === "CONFIRMATION_REQUISE" || /Rien n'a été (créé ni )?payé/.test(r.message) ? r.message : `${r.message} Rien n'a été créé ni payé.`, code: r.code, montant: r.montant };
      if (r.donnees.phrase) notifier.info("Milieu modifié", r.donnees.phrase);
      if (r.donnees.enAttente) notifier.info("La vidéo attend", r.donnees.enAttente);
      else if (!varianteId) notifier.succes(r.donnees.n && r.donnees.n > 1 ? `La première part, les ${r.donnees.n - 1} autres suivront` : "La vidéo part");
      if (varianteId && r.donnees.videoId) suite.current = `/videos/${r.donnees.videoId}`;
      return { ok: true };
    },
    [but, sujetId, varianteId, operationId, ratiosOption],
  );

  return (
    <RelireScript
      lignes={lignes}
      controler={controler}
      lancer={lancer}
      prixCentimes={prixCentimes}
      debit={debit}
      texteLibre
      observation={observation}
      action={but === "modifier" ? { libelle: "Enregistrer · 0 €", icone: "coche" } : undefined}
      apresLancement={() => {
        router.push(suite.current);
        router.refresh();
      }}
    />
  );
}
