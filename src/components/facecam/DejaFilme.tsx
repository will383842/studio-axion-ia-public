"use client";

/**
 * « J'AI DÉJÀ FILMÉ MA VIDÉO » (retour prod du 09/10), en tête de /nouvelle/facecam. Will colle le texte qu'il a dit
 * (tel quel : les sous-titres en viennent), un titre s'il veut, puis « Continuer » : une version face caméra validée
 * est créée sans aucune écriture, et l'écran d'envoi de la vidéo s'ouvre (`/envoyer/<varianteId>`). Le texte est
 * FACULTATIF (18/10) : sans texte, le studio monte la vidéo directement, sans script et sans Claude.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { creerVersionDejaFilmeeAction } from "@/app/(studio)/envoyer/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { ZoneTexte } from "@/components/ui/ZoneTexte";

export function DejaFilme() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [titre, setTitre] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string>();

  async function continuer() {
    setEnCours(true);
    setErreur(undefined);
    const r = await creerVersionDejaFilmeeAction(texte.trim() || undefined, titre.trim() || undefined);
    if (r.ok) {
      router.push(`/envoyer/${r.donnees.varianteId}`);
      return;
    }
    setErreur(r.message);
    setEnCours(false);
  }

  if (!ouvert) {
    return (
      <div className="mb-6">
        <Bouton variante="contour" icone="camera" pleineLargeur onClick={() => setOuvert(true)}>
          J&apos;ai déjà filmé ma vidéo
        </Bouton>
      </div>
    );
  }

  return (
    <section aria-labelledby="deja-filme-titre" className="mb-6 space-y-4 rounded-carte border border-trait bg-surface-1 p-5">
      <h2 id="deja-filme-titre" className="text-base font-semibold text-texte">
        J&apos;ai déjà filmé ma vidéo
      </h2>
      <ZoneTexte libelle="Le texte que vous avez dit (facultatif)" aide="Sans texte, le studio monte votre vidéo directement. Collé tel quel, les sous-titres en viennent." value={texte} onChange={(e) => setTexte(e.target.value)} rows={6} erreur={erreur} />
      <Champ libelle="Titre (facultatif)" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={140} />
      <div className="flex gap-3">
        <Bouton variante="fantome" onClick={() => setOuvert(false)} disabled={enCours}>
          Annuler
        </Bouton>
        <Bouton className="flex-1" iconeDroite="fleche-droite" chargement={enCours} onClick={continuer}>
          Continuer
        </Bouton>
      </div>
    </section>
  );
}
