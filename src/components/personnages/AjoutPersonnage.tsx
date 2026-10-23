"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { creerPersonnageAction } from "@/app/(studio)/personnages/actions";
import { BarreActionCollee, Bouton, Champ, FeuilleBas, Icone, notifier, type NomIcone } from "@/components/ui";
import type { NaturePersonnage } from "@/domaine/types";
import { cn } from "@/lib/cn";

const NATURES: { valeur: NaturePersonnage; titre: string; detail: string; icone: NomIcone }[] = [
  { valeur: "moi", titre: "Moi", detail: "Mon double et ma voix", icone: "personne" },
  { valeur: "reel", titre: "Une vraie personne", detail: "Avec son accord écrit", icone: "bouclier" },
  { valeur: "invente", titre: "Un personnage inventé", detail: "Visage et voix créés", icone: "etincelles" },
];

/** Action principale de /personnages : « Ajouter un personnage » dans une feuille du bas. */
export function AjoutPersonnage({ moiExiste, ouvertAuDepart = false }: { moiExiste: boolean; ouvertAuDepart?: boolean }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(ouvertAuDepart);
  const [nature, setNature] = useState<NaturePersonnage>(moiExiste ? "invente" : "moi");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("");
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  function valider() {
    if (nom.trim().length < 2) return setErreur("Indiquez un nom.");
    setErreur(undefined);
    demarrer(async () => {
      const r = await creerPersonnageAction({ nom, nature, role });
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(nature === "reel" ? `${nom.trim()} est ajouté. Il reste son accord.` : `${nom.trim()} est ajouté.`);
      setOuverte(false);
      setNom("");
      setRole("");
      router.push(`/personnages/${r.donnees.id}${nature === "reel" ? "?onglet=accord" : ""}`);
    });
  }

  return (
    <>
      <BarreActionCollee>
        <Bouton taille="lg" icone="plus" onClick={() => setOuverte(true)}>
          Ajouter un personnage
        </Bouton>
      </BarreActionCollee>
      <FeuilleBas
        ouverte={ouverte}
        onOuverteChange={setOuverte}
        titre="Nouveau personnage"
        pied={
          <Bouton taille="lg" pleineLargeur icone="coche" chargement={enCours} onClick={valider}>
            Ajouter
          </Bouton>
        }
      >
        <div role="radiogroup" aria-label="Qui est-ce ?" className="grid gap-2">
          {NATURES.map((n) => {
            const desactive = n.valeur === "moi" && moiExiste;
            const actif = nature === n.valeur;
            return (
              <button
                key={n.valeur}
                type="button"
                role="radio"
                aria-checked={actif}
                disabled={desactive}
                onClick={() => setNature(n.valeur)}
                className={cn(
                  "relative flex min-h-16 items-center gap-3 rounded-carte border p-3 text-left transition-colors duration-200 disabled:opacity-40",
                  actif ? "border-orange bg-orange-doux" : "border-trait bg-surface-2 hover:border-trait-fort",
                )}
              >
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl transition-colors", actif ? "bg-orange text-sur-orange" : "bg-surface-3 text-texte-doux")}>
                  <Icone nom={n.icone} size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-texte">{n.titre}</span>
                  <span className="text-sm text-texte-faible">{desactive ? "Vous êtes déjà là" : n.detail}</span>
                </span>
                {actif && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-6 place-items-center rounded-full bg-orange text-sur-orange">
                    <Icone nom="coche" size={14} strokeWidth={3} />
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-5 grid gap-4">
          <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={nature === "moi" ? "Williams" : "Prénom Nom"} erreur={erreur} autoComplete="off" maxLength={80} />
          <Champ libelle="Rôle (facultatif)" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Avocate, animatrice…" maxLength={80} />
        </div>
        {nature === "reel" && (
          <p className="mt-4 flex items-center gap-2 rounded-champ bg-ambre-doux px-3 py-2.5 text-sm text-ambre">
            <Icone nom="cadenas" size={16} className="shrink-0" />
            Son double et sa voix restent bloqués sans accord.
          </p>
        )}
      </FeuilleBas>
    </>
  );
}
