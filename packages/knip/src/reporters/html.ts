import type { Entries } from '../types/entries.ts';
import type { Issue, ReporterOptions } from '../types/issues.ts';
import { relative } from '../util/path.ts';
import { flattenIssues, getIssueTypeTitle } from './util/util.ts';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const styles = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 2rem; color: #24292f; background: #fff; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.15rem; margin-top: 2rem; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3rem; }
    .summary { color: #57606a; margin-top: 0; }
    .empty { color: #57606a; }
    table { border-collapse: collapse; width: 100%; margin: 0.5rem 0 1.5rem; font-size: 0.9rem; }
    th, td { border: 1px solid #d0d7de; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
    th { background: #f6f8fa; }
    tbody tr:nth-child(even) td { background: #f6f8fa; }
    td.symbol, td.file, td.location { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .severity-error { color: #cf222e; font-weight: 600; }
    .severity-warn { color: #9a6700; }`;

export default ({ report, issues, cwd }: ReporterOptions) => {
  const getSymbol = (issue: Issue) => (issue.symbols ? issue.symbols.map(s => s.symbol).join(', ') : issue.symbol);

  const getLocation = (issue: Issue) => {
    if (issue.line === undefined) return '';
    return issue.col === undefined ? String(issue.line) : `${issue.line}:${issue.col}`;
  };

  const sortByPos = (a: Issue, b: Issue) => {
    if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
    if (a.line !== b.line) return (a.line ?? 0) - (b.line ?? 0);
    return (a.col ?? 0) - (b.col ?? 0);
  };

  const sections: string[] = [];
  let totalIssues = 0;

  for (const [reportType, isReportType] of Object.entries(report) as Entries<typeof report>) {
    if (!isReportType) continue;

    const issuesForType = flattenIssues(issues[reportType]);
    if (issuesForType.length === 0) continue;

    totalIssues += issuesForType.length;
    const title = escapeHtml(getIssueTypeTitle(reportType));

    const rows = issuesForType
      .sort(sortByPos)
      .map(issue => {
        const symbol = escapeHtml(getSymbol(issue));
        const file = escapeHtml(relative(cwd, issue.filePath));
        const location = escapeHtml(getLocation(issue));
        const severity = issue.severity ?? '';
        const severityClass = severity ? ` severity-${severity}` : '';
        return `          <tr>
            <td class="symbol">${symbol}</td>
            <td class="file">${file}</td>
            <td class="location">${location}</td>
            <td class="severity${severityClass}">${escapeHtml(severity)}</td>
          </tr>`;
      })
      .join('\n');

    sections.push(`    <section>
      <h2>${title} (${issuesForType.length})</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>File</th><th>Location</th><th>Severity</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </section>`);
  }

  const body = sections.length > 0 ? sections.join('\n') : '    <p class="empty">No issues found.</p>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Knip report</title>
  <style>${styles}
  </style>
</head>
<body>
  <h1>Knip report</h1>
  <p class="summary">${totalIssues} ${totalIssues === 1 ? 'issue' : 'issues'} found</p>
${body}
</body>
</html>`;

  // See: https://github.com/nodejs/node/issues/6379
  // @ts-expect-error _handle is private
  process.stdout._handle?.setBlocking?.(true);
  process.stdout.write(`${html}\n`);
};
