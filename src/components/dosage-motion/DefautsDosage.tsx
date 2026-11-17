"use client";

/**
 * « Animations par défaut » (X3-10b-a). Composant neuf, monté nulle part.
 * Il ne lit aucun réglage et n'écrit rien lui-même : tout arrive en propriétés, le choix part par `surChoisir`.
 * Éteint : tant que `actif` n'est pas exactement `true`, il ne rend rien.
 */
import { useRef, useState } from "react";
import { SelecteurPastilles, type OptionPastille } from "@/components/ui";
import { CRANS_PERMIS, PHRASE_CRAN_GRISE, type DosageMotion, type IdGenerateurDosage } from "@/briques/dosage-motion";

export type ResultatChoixDefaut = { ok: true } | { ok: false; message: string };

export const LIBELLES_GENERATEURS: Record<IdGenerateurDosage, string> = {
  avocat: "Vidéo avocat",
  facecam: "Face caméra",
  "facecam-animee": "Face caméra animée",
  "cas-concret": "Cas concret",
  tableau: "Tableau",
  "image-video": "Image en vidéo",
  "demo-facecam": "Démonstration face caméra",
  "tutoriel-outil": "Tutoriel d'un outil",
};

const LIBELLES_CRANS: Record<DosageMotion, string> = {
  aucun: "Aucun",
  sobre: "Sobre",
  equilibre: "Équilibré",
  dynamique: "Dynamique",
};

const ORDRE: readonly DosageMotion[] = ["aucun", "sobre", "equilibre", "dynamique"];
const MESSAGE_ECHEC = "Le choix n'a pas pu être enregistré. Réessayez.";

export type SurChoisir = (generateur: IdGenerateurDosage, cran: DosageMotion) => Promise<ResultatChoixDefaut>;

const permis = (g: IdGenerateurDosage): DosageMotion[] => ORDRE.filter((c) => CRANS_PERMIS[g].includes(c));

/** Envoie le choix : null si tout va bien (ou rien à envoyer), sinon le message à afficher. */
export async function envoyerDefaut(surChoisir: SurChoisir | undefined, generateur: IdGenerateurDosage, cran: DosageMotion): Promise<string | null> {
  if (!surChoisir || !CRANS_PERMIS[generateur].includes(cran)) return null;
  try {
    const r = await surChoisir(generateur, cran);
    return r.ok ? null : r.message;
  } catch {
    return MESSAGE_ECHEC;
  }
}

export interface DefautsDosageProps {
  actif: boolean;
  defauts: Record<IdGenerateurDosage, DosageMotion>;
  surChoisir?: SurChoisir;
}

export function DefautsDosage({ actif, defauts, surChoisir }: DefautsDosageProps) {
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [choisis, setChoisis] = useState<Partial<Record<IdGenerateurDosage, DosageMotion>>>({});
  const verrou = useRef(false);
  if (actif !== true) return null;

  async function choisir(g: IdGenerateurDosage, cran: DosageMotion) {
    if (verrou.current) return;
    verrou.current = true;
    setEnvoi(true);
    setMessage(null);
    const refus = await envoyerDefaut(surChoisir, g, cran);
    if (refus === null) setChoisis((c) => ({ ...c, [g]: cran }));
    setMessage(refus);
    verrou.current = false;
    setEnvoi(false);
  }

  const generateurs = Object.keys(CRANS_PERMIS) as IdGenerateurDosage[];
  return (
    <section className="flex flex-col gap-4" aria-label="Animations par défaut">
      <h2 className="text-lg font-semibold text-texte">Animations par défaut</h2>
      {generateurs.map((g) => {
        const crans = permis(g);
        const manque = crans.length < ORDRE.length;
        const phrase = g === "facecam-animee" ? PHRASE_CRAN_GRISE.v4 : PHRASE_CRAN_GRISE.animations;
        const options: OptionPastille<DosageMotion>[] = crans.map((c) => ({ valeur: c, libelle: LIBELLES_CRANS[c], desactive: envoi }));
        return (
          <div key={g} data-generateur={g} className="flex flex-col gap-2">
            <SelecteurPastilles<DosageMotion> libelle={LIBELLES_GENERATEURS[g]} options={options} valeur={choisis[g] ?? defauts[g]} onChange={(c) => void choisir(g, c)} />
            {manque && <p className="text-sm text-texte-faible">{phrase}</p>}
          </div>
        );
      })}
      {message !== null && (
        <p role="alert" className="text-sm text-texte-doux">
          {message}
        </p>
      )}
    </section>
  );
}
