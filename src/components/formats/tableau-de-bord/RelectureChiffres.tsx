"use client";

/**
 * Relecture des chiffres d'un tableau de bord (G4-08a) : Will valide, corrige ou refuse chaque chiffre.
 * Reçoit tout en propriétés ; aucun appel, monté nulle part. L'unité est lue dans la donnée.
 */
import { useId, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import type { ChiffreARelire, DecisionChiffre } from "@/briques/donnees-video/relecture-chiffres";

const enFrancais = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 6 });
const avecUnite = (n: number, unite: string) => (unite ? `${enFrancais(n)} ${unite}` : enFrancais(n));

function mention(decision: DecisionChiffre | undefined, unite: string): string | null {
  if (!decision) return null;
  if (decision.type === "valide") return "Validé";
  if (decision.type === "corrige") return `Corrigé : ${avecUnite(decision.valeur, unite)}`;
  return "Refusé";
}

function Ligne({ chiffre, decision, onDecider, desactive }: { chiffre: ChiffreARelire; decision?: DecisionChiffre; onDecider: (cle: string, decision: DecisionChiffre) => void; desactive?: boolean }) {
  const idChamp = useId();
  const [saisie, setSaisie] = useState("");
  const texte = saisie.trim().replace(",", ".");
  const nombre = texte === "" ? Number.NaN : Number(texte);
  const etat = mention(decision, chiffre.unite);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-champ border border-trait bg-surface-1 px-4 py-3 font-texte">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-texte">{chiffre.libelle}</p>
        <p className="text-sm text-texte-doux">{avecUnite(chiffre.valeur, chiffre.unite)}</p>
        {etat && <p className="text-sm font-semibold text-accent">{etat}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Bouton variante="secondaire" sansDecompte disabled={desactive} onClick={() => onDecider(chiffre.cle, { type: "valide" })}>
          Valider
        </Bouton>
        <label htmlFor={idChamp} className="sr-only">
          Nouvelle valeur de {chiffre.libelle}
        </label>
        <input
          id={idChamp}
          type="number"
          inputMode="decimal"
          step="any"
          value={saisie}
          disabled={desactive}
          onChange={(e) => setSaisie(e.target.value)}
          className="min-h-11 w-28 rounded-champ border border-trait bg-surface-1 px-3 text-sm text-texte focus:border-accent"
        />
        <Bouton variante="secondaire" sansDecompte disabled={desactive || !Number.isFinite(nombre)} onClick={() => onDecider(chiffre.cle, { type: "corrige", valeur: nombre })}>
          Corriger
        </Bouton>
        <Bouton variante="danger" sansDecompte disabled={desactive} onClick={() => onDecider(chiffre.cle, { type: "refuse" })}>
          Refuser
        </Bouton>
      </div>
    </li>
  );
}

export function RelectureChiffres({
  chiffres,
  decisions,
  onDecider,
  desactive,
}: {
  chiffres: ChiffreARelire[];
  decisions: Record<string, DecisionChiffre>;
  onDecider: (cle: string, decision: DecisionChiffre) => void;
  desactive?: boolean;
}) {
  const relus = chiffres.filter((c) => decisions[c.cle]).length;
  return (
    <section className="space-y-3 font-texte">
      <p className="text-sm font-semibold text-texte-doux">
        {relus} chiffres relus sur {chiffres.length}
      </p>
      <ul className="space-y-2">
        {chiffres.map((c) => (
          <Ligne key={c.cle} chiffre={c} decision={decisions[c.cle]} onDecider={onDecider} desactive={desactive} />
        ))}
      </ul>
    </section>
  );
}
