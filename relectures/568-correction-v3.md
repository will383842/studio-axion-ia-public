# Correction PR 568 (v3) : fiche MAQ-01

Commit ajouté sur `usine/MAQ-01-v2` (sans réécriture d'historique), après `ca497989`.

- Test des maquettes : contrôles rétablis (motifs privés lus hors dépôt, ignorés sans fichier ; aucune étiquette « Essai » ; aucune ressource externe, polices Google comprises ; liens absolus refusés ; « $ » seul refusé ; formes tutoyées peux/veux/as/es/tiens).
- Scripts : gardés en ligne dans les 4 pages (maquette validée par le fondateur le 14/11). Le test refuse `<script src=` et tout appel réseau (fetch, XMLHttpRequest, WebSocket, sendBeacon, import(), EventSource).
- Description de la PR corrigée : « sans être affaibli » retiré.
- Preuves : 58/58 verts. Mutations testées : lien fonts.googleapis.com, `fetch`, `<script src=` et motif privé font rougir le test. Les 4 pages HTML n'ont pas été touchées.
