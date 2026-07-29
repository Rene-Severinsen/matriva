# Matriva Website

Foundation til Matrivas offentlige website.

## Krav

- Node.js 20+
- npm 10+

## Lokal udvikling

```bash
npm install
npm run dev
```

Åbn `http://localhost:3000`.

## Kontrol

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Tema

Farver, afstande, radius og øvrige centrale designværdier ligger i:

```text
app/theme.css
```

Farvepaletten kan udskiftes uden at ændre komponenternes struktur.
