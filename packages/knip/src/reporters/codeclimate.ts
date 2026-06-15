import { createHash } from 'node:crypto';
import type * as codeclimate from 'codeclimate-types';
import type { Entries } from '../types/entries.ts';
import type { Issue, IssueSeverity, IssueSymbol, IssueType, Report, ReporterOptions } from '../types/issues.ts';
import { toRelative } from '../util/path.ts';
import { flattenIssues, getIssuePrefix, getIssueTypeTitle } from './util/util.ts';

export default async ({ report, issues, cwd, sort }: ReporterOptions) => {
  const entries: codeclimate.Issue[] = [];

  for (const [type, isReportType] of Object.entries(report) as Entries<Report>) {
    if (!isReportType) {
      continue;
    }

    for (const issue of flattenIssues(issues[type])) {
      const { filePath } = issue;

      if (type === 'duplicates' && issue.symbols) {
        entries.push(
          ...issue.symbols.map<codeclimate.Issue>(symbol => ({
            type: 'issue',
            check_name: getIssueTypeTitle(type),
            description: getSymbolDescription({ type: issue.type, symbol, parentSymbol: issue.parentSymbol }),
            categories: ['Duplication'],
            location: createLocation(filePath, cwd, symbol.line, symbol.col),
            severity: convertSeverity(issue.severity),
            fingerprint: createFingerprint(filePath, cwd, symbol.symbol),
          }))
        );
      } else {
        entries.push({
          type: 'issue',
          check_name: getIssueTypeTitle(type),
          description: getIssueDescription(issue),
          categories: ['Bug Risk'],
          location: createLocation(filePath, cwd, issue.line, issue.col),
          severity: convertSeverity(issue.severity),
          fingerprint: createFingerprint(filePath, cwd, issue.symbol),
        });
      }
    }
  }

  if (sort === 'severity') {
    const severityOrder: Record<string, number> = { major: 0, minor: 1, info: 2 };
    entries.sort(
      (a, b) =>
        (severityOrder[a.severity ?? 'info'] ?? 2) - (severityOrder[b.severity ?? 'info'] ?? 2) ||
        (a.location.path ?? '').localeCompare(b.location.path ?? '')
    );
  } else if (sort === 'file') {
    entries.sort((a, b) => (a.location.path ?? '').localeCompare(b.location.path ?? ''));
  } else if (sort === 'symbol') {
    entries.sort((a, b) => a.description.localeCompare(b.description));
  }

  const output = JSON.stringify(entries);

  // See: https://github.com/nodejs/node/issues/6379
  // @ts-expect-error _handle is private
  process.stdout._handle?.setBlocking?.(true);
  process.stdout.write(`${output}\n`);
};

function convertSeverity(severity?: IssueSeverity): codeclimate.Severity {
  switch (severity) {
    case 'error':
      return 'major';
    case 'warn':
      return 'minor';
    default:
      return 'info';
  }
}

function getIssueDescription({ type, symbol, symbols, parentSymbol }: Issue) {
  const symbolDescription = symbols ? `${symbols.map(s => s.symbol).join(', ')}` : symbol;
  return `${getIssuePrefix(type)}: ${symbolDescription}${parentSymbol ? ` (${parentSymbol})` : ''}`;
}

function getSymbolDescription({
  type,
  symbol,
  parentSymbol,
}: {
  type: IssueType;
  symbol: IssueSymbol;
  parentSymbol?: string;
}) {
  return `${getIssuePrefix(type)}: ${symbol.symbol}${parentSymbol ? ` (${parentSymbol})` : ''}`;
}

function createLocation(filePath: string, cwd: string, line?: number, col?: number): codeclimate.Location {
  if (col !== undefined) {
    return {
      path: toRelative(filePath, cwd),
      positions: {
        begin: {
          line: line ?? 0,
          column: col,
        },
        end: {
          line: line ?? 0,
          column: col,
        },
      },
    };
  }

  return {
    path: toRelative(filePath, cwd),
    lines: {
      begin: line ?? 0,
      end: line ?? 0,
    },
  };
}

function createFingerprint(filePath: string, cwd: string, message: string): string {
  const md5 = createHash('md5');

  md5.update(toRelative(filePath, cwd));
  md5.update(message);

  return md5.digest('hex');
}
