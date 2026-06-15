import { writeFile } from 'node:fs/promises';
import type { Entries } from '../types/entries.ts';
import type { Issue, ReporterOptions } from '../types/issues.ts';
import { relative } from '../util/path.ts';
import { flattenIssues, getIssueTypeTitle } from './util/util.ts';

type ExtraReporterOptions = {
  file?: string;
};

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const getStyle = () => `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1f2328; background: #fff; padding: 24px; max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 1.6rem; margin-bottom: 8px; }
  .summary { color: #656d76; margin-bottom: 24px; font-size: 0.9rem; }
  .issue-group { margin-bottom: 32px; }
  .issue-group h2 { font-size: 1.2rem; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #d1d9e0; }
  .count { color: #656d76; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; padding: 8px 12px; background: #f6f8fa; border: 1px solid #d1d9e0; font-weight: 600; white-space: nowrap; }
  td { padding: 6px 12px; border: 1px solid #d1d9e0; vertical-align: top; }
  tr:nth-child(even) td { background: #f6f8fa; }
  .col-severity { width: 70px; text-align: center; }
  .col-line { width: 60px; text-align: right; }
  .col-col { width: 50px; text-align: right; }
  .severity-error { color: #cf222e; font-weight: 600; }
  .severity-warn { color: #9a6700; font-weight: 600; }
  code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 0.85em; }
  .empty { color: #656d76; font-style: italic; margin-top: 16px; }
`;

export default async ({ report, issues, options, cwd, counters }: ReporterOptions) => {
  let opts: ExtraReporterOptions = {};
  try {
    opts = options ? JSON.parse(options) : opts;
  } catch {
    // ignore parse errors
  }

  const getFilePath = (issue: Issue) => relative(cwd, issue.filePath);

  const totalIssues = counters.total;
  const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  const sections: string[] = [];

  for (const [reportType, isReportType] of Object.entries(report) as Entries<typeof report>) {
    if (!isReportType) continue;

    const title = getIssueTypeTitle(reportType);
    const issuesForType = flattenIssues(issues[reportType]);
    if (issuesForType.length === 0) continue;

    const rows = issuesForType
      .sort((a, b) => {
        if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
        return (a.line ?? 0) - (b.line ?? 0) || (a.col ?? 0) - (b.col ?? 0);
      })
      .map(issue => {
        const severity = issue.severity ?? 'error';
        const severityClass = `severity-${severity}`;
        return `        <tr>
          <td><code>${escapeHtml(getFilePath(issue))}</code></td>
          <td><code>${escapeHtml(issue.symbol)}</code></td>
          <td class="col-line">${issue.line ?? ''}</td>
          <td class="col-col">${issue.col ?? ''}</td>
          <td class="col-severity ${severityClass}">${severity}</td>
        </tr>`;
      })
      .join('\n');

    sections.push(`    <section class="issue-group">
      <h2>${escapeHtml(title)} <span class="count">(${issuesForType.length})</span></h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Symbol</th>
            <th class="col-line">Line</th>
            <th class="col-col">Col</th>
            <th class="col-severity">Severity</th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </section>`);
  }

  const body =
    sections.length > 0
      ? sections.join('\n')
      : '    <p class="empty">No issues found. Your project is clean!</p>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Knip Report</title>
  <style>${getStyle()}
  </style>
</head>
<body>
  <h1>Knip Report</h1>
  <p class="summary">${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found &middot; Generated ${escapeHtml(timestamp)}</p>
${body}
</body>
</html>
`;

  if (opts.file) {
    await writeFile(opts.file, html, 'utf-8');
  } else {
    // See: https://github.com/nodejs/node/issues/6379
    // @ts-expect-error _handle is private
    process.stdout._handle?.setBlocking?.(true);
    process.stdout.write(`${html}\n`);
  }
};
