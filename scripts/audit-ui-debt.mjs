import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const componentsRoot = path.resolve('src/components');
const reportPath = path.resolve('artifacts/ui-debt-report.md');

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(target);
    return entry.name.endsWith('V2.jsx') ? [target] : [];
  }));
  return nested.flat();
}

function locate(source, expression) {
  const matches = [];
  for (const match of source.matchAll(expression)) {
    matches.push(source.slice(0, match.index).split('\n').length);
  }
  return matches;
}

const definitions = [
  ['KPI locaux restants', /function\s+Kpi\b|<Kpi(?!Card)\b/g],
  ['ActionBar locales restantes', /<(?:section|div)\b(?:(?!>).)*className="[^"]*(?:-v2-actions|action-bar)[^"]*"/gs],
  ['Cards locales restantes', /<(?:article|section|div|form)\b(?:(?!>).)*className=(?:"[^"]*v2-card[^"]*"|\{`[^`]*v2-card[^`]*`\})/gs],
  ['Charts locaux restants', /function\s+\w*(?:Chart|Donut|Sparkline)\b|<svg\b|<(?:div|i)\b(?:(?!>).)*className="(?:v2-progress|v2-saving-bar|budgets-v2-progress|objectives-v2-(?:global-bar|progress))"/gs],
  ['Dialogs locaux restants', /<(?:div|form|section|aside)\b(?:(?!>).)*(?:role="dialog"|className="[^"]*dialog-backdrop[^"]*")/gs],
  ['Inputs locaux restants', /<(?:input|select|textarea)\b/g],
  ['EmptyStates locaux restants', /function\s+(?:EmptyState|LoadingState|ErrorState)\b|<(?:div|section|p)\b(?:(?!>).)*(?:role="alert"|className=(?:"[^"]*(?:-empty|v2-empty|-loading|-error)[^"]*"|\{`[^`]*(?:-empty|v2-empty|-loading|-error)[^`]*`\}))/gs],
];

const files = await collect(componentsRoot);
const results = [];
for (const [label, expression] of definitions) {
  const occurrences = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const line of locate(source, expression)) occurrences.push({ file: path.relative(process.cwd(), file).replaceAll('\\', '/'), line });
  }
  results.push({ label, occurrences });
}

const generatedAt = new Date().toISOString();
const lines = ['# Rapport de dette UI Horizon', '', `Généré automatiquement le ${generatedAt}.`, '', 'Périmètre : fichiers `*V2.jsx`. Une occurrence signale un composant local qui contourne le Design System.', '', '| Catégorie | Occurrences | Fichiers |', '| --- | ---: | ---: |'];
for (const result of results) lines.push(`| ${result.label} | ${result.occurrences.length} | ${new Set(result.occurrences.map((item) => item.file)).size} |`);
for (const result of results) {
  lines.push('', `## ${result.label}`, '');
  if (!result.occurrences.length) lines.push('Aucune occurrence.');
  else for (const item of result.occurrences) lines.push('- `' + item.file + ':' + item.line + '`');
}
lines.push('');
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, lines.join('\n'), 'utf8');
console.log(`Rapport écrit : ${reportPath}`);
for (const result of results) console.log(`${result.label}: ${result.occurrences.length}`);
