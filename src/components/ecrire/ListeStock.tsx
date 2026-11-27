"use client";

import { useState } from "react";
import { filtrerStock, etatDe, reseauxDe, type EtatStock, type MessageStock } from "@/domaine/stock-messages";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";
import type { IdReseau } from "@/domaine/types";
import { nomDuReseau } from "@/reseaux/hors-video";

const ETATS: { valeur: EtatStock; libelle: string }[] = [
  { valeur: "en-stock", libelle: "À placer" },
  { valeur: "planifie", libelle: "Planifié" },
  { valeur: "publie", libelle: "Publié" },
];
const RESEAUX = RESEAUX_TAXONOMIE;
const nom = (r: IdReseau) => nomDuReseau(r);

/** Textes mis de côté : filtres par réseau, état et échéance. Liste distincte des idées et des scripts. */
export function ListeStock({ entrees }: { entrees: MessageStock[] }) {
  const [reseau, setReseau] = useState<IdReseau | "">("");
  const [etat, setEtat] = useState<EtatStock | "">("en-stock");
  const [avant, setAvant] = useState("");
  const liste = filtrerStock(entrees, { reseau: reseau || undefined, etat: etat || undefined, echeanceAvant: avant || undefined });
  return (
    <section aria-label="Mes textes">
      <div className="flex flex-wrap gap-3">
        <label>
          Réseau{" "}
          <select value={reseau} onChange={(ev) => setReseau(ev.target.value as IdReseau | "")}>
            <option value="">Tous</option>
            {RESEAUX.map((r) => (
              <option key={r} value={r}>{nom(r)}</option>
            ))}
          </select>
        </label>
        <label>
          État{" "}
          <select value={etat} onChange={(ev) => setEtat(ev.target.value as EtatStock | "")}>
            <option value="">Tous</option>
            {ETATS.map((x) => (
              <option key={x.valeur} value={x.valeur}>{x.libelle}</option>
            ))}
          </select>
        </label>
        <label>
          Échéance avant le <input type="date" value={avant} onChange={(ev) => setAvant(ev.target.value)} />
        </label>
      </div>
      {liste.length === 0 ? (
        <p>Aucun texte à placer pour ces critères.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {liste.map((m) => (
            <li key={m.id}>
              <p>{m.texte}</p>
              <p className="text-sm">
                {reseauxDe(m).map(nom).join(", ")} · priorité {m.priorite ?? "normale"}
                {m.echeance ? ` · à faire avant le ${m.echeance}` : ""} · {ETATS.find((x) => x.valeur === etatDe(m))?.libelle}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
