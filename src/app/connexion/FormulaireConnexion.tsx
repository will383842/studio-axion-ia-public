"use client";

import { motion } from "motion/react";
import { useActionState, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { connexionAction, type EtatConnexion } from "./actions";

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(connexionAction, {});
  const [rester, setRester] = useState(true);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="suite" value={suite} />
      <input type="hidden" name="resterConnecte" value={rester ? "on" : "off"} />
      <motion.div animate={etat.message ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.35 }} key={etat.message ?? "stable"}>
        <Champ
          libelle="Mot de passe"
          name="motDePasse"
          motDePasse
          grand
          icone="cadenas"
          autoComplete="current-password"
          autoFocus
          required
          erreur={etat.message}
          disabled={enCours}
        />
      </motion.div>
      <Interrupteur libelle="Rester connecté" detail="30 jours sur cet appareil" coche={rester} onChange={setRester} />
      <Bouton type="submit" taille="xl" pleineLargeur chargement={enCours} iconeDroite={enCours ? undefined : "fleche-droite"}>
        Entrer
      </Bouton>
    </form>
  );
}
