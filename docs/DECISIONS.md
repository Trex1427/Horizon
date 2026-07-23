# Decisions d'architecture

## ADR-0001

- Titre: Reference Model
- Resume: formalise la separation entre categorie, sous-categorie, activite, projet et tiers, ainsi que leur rattachement explicite aux transactions.
- Lien: [ADR-0001-reference-model.md](./adr/ADR-0001-reference-model.md)

## ADR-0002

- Titre: Transfer Model
- Resume: fixe la regle selon laquelle un transfert interne n'est pas une transaction standard et doit rester stocke dans la collection `transfers`.
- Lien: [ADR-0002-transfer-model.md](./adr/ADR-0002-transfer-model.md)

## ADR-0003

- Titre: Import Pipeline
- Resume: formalise le pipeline d'import bancaire en detection, parsing, normalisation, previsualisation, validation, commit et historisation.
- Lien: [ADR-0003-import-pipeline.md](./adr/ADR-0003-import-pipeline.md)

## ADR-0004

- Titre: Documentation Policy
- Resume: impose la maintenance conjointe de la documentation d'architecture, du tableau de bord Horizon et des ADR pour toute evolution structurelle importante.
- Lien: [ADR-0004-documentation-policy.md](./adr/ADR-0004-documentation-policy.md)