"use client";

/**
 * CHOISIR MON DOUBLE HEYGEN (lot R7) — Will crée et essaie son double dans l'application HeyGen ; ici, il le choisit
 * pour ses vidéos : UN ou DEUX avatars (lot R7e : angle principal trois-quarts, second angle presque de face). Mots
 * simples, aucun nom technique, rien de payant.
 */
import { useState, useTransition } from "react";
import { choisirDoubleHeygenAction, listerDoublesHeygenAction } from "@/app/(studio)/personnages/actions";
import { Bouton, Champ, EtatVide, FeuilleBas, Icone, notifier, Pastille, SelecteurPastilles } from "@/components/ui";
import type { AngleVisage } from "@/domaine/types";
import type { DoubleHeygenAffiche } from "@/services/doubles-heygen";

const ANGLES: { valeur: AngleVisage; libelle: string }[] = [
  { valeur: "trois-quarts", libelle: "Angle principal, trois quarts" },
  { valeur: "face", libelle: "Second angle, presque de face" },
];

/** Avant de créer le double dans HeyGen : ce qui fait un double réaliste (version courte du guide de tournage). */
export const CONSEILS_DOUBLE_HEYGEN = [
  "Téléphone à la verticale, sur un support, vidéo HDR coupée, 25 images par seconde.",
  "Assis, de la tête à mi-cuisse, fond gris uni (jamais vert), lumière douce du côté de votre regard.",
  "Le regard posé sur une personne à côté du téléphone dès la première image, jamais dans l'objectif.",
  "Une prise de trois quarts, puis une presque de face, même tenue et même lumière.",
];

export function ChoixDoubleHeygen({ personnageId, verrouille }: { personnageId: string; verrouille: boolean }) {
  const [ouverte, setOuverte] = useState(false);
  const [liste, setListe] = useState<{ branche: boolean; doubles: DoubleHeygenAffiche[] } | null>(null);
  const [angle, setAngle] = useState<AngleVisage>("trois-quarts");
  const [tenue, setTenue] = useState("");
  const [enCours, demarrer] = useTransition();

  function ouvrir() {
    setOuverte(true);
    demarrer(async () => {
      const r = await listerDoublesHeygenAction(personnageId);
      if (!r.ok) return void notifier.erreur(r.message);
      setListe(r.donnees);
    });
  }

  function choisir(d: DoubleHeygenAffiche) {
    demarrer(async () => {
      const r = await choisirDoubleHeygenAction(personnageId, { idExterne: d.idExterne, angle, tenue });
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes("Double relié à ce personnage");
      setOuverte(false);
    });
  }

  return (
    <>
      <Bouton variante="secondaire" icone="visage" disabled={verrouille} onClick={ouvrir}>
        Choisir mon double HeyGen
      </Bouton>
      <FeuilleBas ouverte={ouverte} onOuverteChange={setOuverte} titre="Mon double HeyGen" description="Créé dans l'application HeyGen, relié ici à ce personnage.">
        <div className="grid gap-5">
          <SelecteurPastilles libelle="Angle" options={ANGLES} valeur={angle} onChange={setAngle} />
          <Champ libelle="Tenue" value={tenue} onChange={(e) => setTenue(e.target.value)} placeholder="Chemise noire" maxLength={60} />
          <ListeDoubles liste={liste} enCours={enCours} onChoisir={choisir} />
          <section aria-label="Bien filmer votre double" className="grid gap-2 rounded-carte border border-trait bg-surface-1 p-4">
            <p className="text-sm font-semibold text-texte">Pour un double réaliste dans HeyGen</p>
            <ul className="grid gap-1.5">
              {CONSEILS_DOUBLE_HEYGEN.map((c) => (
                <li key={c} className="flex gap-2 text-sm text-texte-doux">
                  <Icone nom="coche" size={15} className="mt-0.5 shrink-0 text-sauge" />
                  {c}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </FeuilleBas>
    </>
  );
}

export function ListeDoubles({ liste, enCours, onChoisir }: { liste: { branche: boolean; doubles: DoubleHeygenAffiche[] } | null; enCours: boolean; onChoisir: (d: DoubleHeygenAffiche) => void }) {
  if (!liste) return <p className="text-sm text-texte-faible">{enCours ? "Lecture de votre compte HeyGen…" : ""}</p>;
  if (!liste.branche) return <EtatVide compact icone="visage" titre="HeyGen n'est pas encore relié" phrase="Le double HeyGen n'est pas encore branché sur le serveur." />;
  if (!liste.doubles.length) return <EtatVide compact icone="visage" titre="Aucun double dans votre compte" phrase="Créez votre double dans l'application HeyGen, puis revenez ici." />;
  return (
    <ul className="grid gap-2">
      {liste.doubles.map((d) => (
        <li key={d.idExterne} className="flex flex-wrap items-center gap-3 rounded-carte border border-trait bg-surface-2 p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-texte-doux">
            <Icone nom="visage" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-texte">{d.nom}</span>
            {d.raison && <span className="block text-sm text-texte-faible">{d.raison}</span>}
          </span>
          {d.utiliseParVisageId ? (
            <Pastille ton="sauge" icone="coche">
              Déjà choisi
            </Pastille>
          ) : d.utilisable ? (
            <Bouton chargement={enCours} onClick={() => onChoisir(d)}>
              Utiliser ce double
            </Bouton>
          ) : (
            <Pastille ton="ambre">Pas encore prêt</Pastille>
          )}
        </li>
      ))}
    </ul>
  );
}
