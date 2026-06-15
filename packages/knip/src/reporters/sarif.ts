import type { Entries } from '../types/entries.ts';
import type { IssueSeverity, IssueType, Report, ReporterOptions } from '../types/issues.ts';
import { toRelative } from '../util/path.ts';
import { version } from '../version.ts';
import { flattenIssues, getIssuePrefix, getIssueTypeTitle } from './util/util.ts';

// Minimal subset of the SARIF v2.1.0 schema used by this reporter.
// See: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
type SarifLevel = 'error' | 'warning' | 'note' | 'none';

interface SarifRegion {
  startLine: number;
  startColumn?: number;
}

interface SarifPhysicalLocation {
  artifactLocation: { uri: string };
  region?: SarifRegion;
}

interface SarifLocation {
  physicalLocation: SarifPhysicalLocation;
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: SarifLocation[];
}

interface SarifReportingDescriptor {
  id: string;
  name: string;
  shortDescription: { text: string };
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      informationUri: string;
      version: string;
      rules: SarifReportingDescriptor[];
    };
  };
  results: SarifResult[];
}

interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: SarifRun[];
}

export default async ({ report, issues, cwd }: ReporterOptions) => {
  const results: SarifResult[] = [];
  const ruleIds = new Set<IssueType>();

  for (const [type, isReportType] of Object.entries(report) as Entries<Report>) {
    if (!isReportType) {
      continue;
    }

    for (const issue of flattenIssues(issues[type])) {
      const { filePath } = issue;

      if (type === 'duplicates' && issue.symbols) {
        for (const symbol of issue.symbols) {
          ruleIds.add(type);
          results.push({
            ruleId: type,
            level: convertLevel(issue.severity),
            message: { text: getMessage(type, symbol.symbol, issue.parentSymbol) },
            locations: [createLocation(filePath, cwd, symbol.line, symbol.col)],
          });
        }
      } else {
        ruleIds.add(type);
        results.push({
          ruleId: type,
          level: convertLevel(issue.severity),
          message: { text: getMessage(type, issue.symbol, issue.parentSymbol) },
          locations: [createLocation(filePath, cwd, issue.line, issue.col)],
        });
      }
    }
  }

  const rules: SarifReportingDescriptor[] = [...ruleIds].map(id => ({
    id,
    name: getIssueTypeTitle(id),
    shortDescription: { text: getIssueTypeTitle(id) },
  }));

  const sarif: SarifLog = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Knip',
            informationUri: 'https://knip.dev',
            version,
            rules,
          },
        },
        results,
      },
    ],
  };

  const output = JSON.stringify(sarif);

  // See: https://github.com/nodejs/node/issues/6379
  // @ts-expect-error _handle is private
  process.stdout._handle?.setBlocking?.(true);
  process.stdout.write(`${output}\n`);
};

function convertLevel(severity?: IssueSeverity): SarifLevel {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    default:
      return 'note';
  }
}

function getMessage(type: IssueType, symbol: string, parentSymbol?: string) {
  return `${getIssuePrefix(type)}: ${symbol}${parentSymbol ? ` (${parentSymbol})` : ''}`;
}

function createLocation(filePath: string, cwd: string, line?: number, col?: number): SarifLocation {
  const region = line === undefined ? undefined : { startLine: line, ...(col === undefined ? {} : { startColumn: col }) };
  return {
    physicalLocation: {
      artifactLocation: { uri: toRelative(filePath, cwd) },
      ...(region && { region }),
    },
  };
}
