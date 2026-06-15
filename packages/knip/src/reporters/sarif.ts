import { createHash } from 'node:crypto';
import type { Entries } from '../types/entries.ts';
import type { Issue, IssueRecords, IssueSeverity, Report, ReporterOptions } from '../types/issues.ts';
import { toRelative } from '../util/path.ts';
import { flattenIssues, getIssuePrefix, getIssueTypeTitle } from './util/util.ts';

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: {
        uri: string;
        uriBaseId: string;
      };
      region?: {
        startLine: number;
        startColumn?: number;
      };
    };
  }>;
  partialFingerprints: {
    issueHash: string;
  };
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
}

interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: [
    {
      tool: {
        driver: {
          name: string;
          informationUri: string;
          version: string;
          rules: SarifRule[];
        };
      };
      originalUriBaseIds: {
        SRCROOT: { uri: string };
      };
      results: SarifResult[];
    },
  ];
}

const ruleOrder: Array<keyof Report> = [
  'files',
  'dependencies',
  'devDependencies',
  'optionalPeerDependencies',
  'unlisted',
  'binaries',
  'unresolved',
  'exports',
  'types',
  'nsExports',
  'nsTypes',
  'enumMembers',
  'namespaceMembers',
  'duplicates',
  'catalog',
];

export default async ({ report, issues, cwd }: ReporterOptions) => {
  const rules: SarifRule[] = [];
  const ruleIndexMap = new Map<string, number>();

  for (const type of ruleOrder) {
    if (!report[type]) continue;
    const ruleId = `knip/${type}`;
    ruleIndexMap.set(ruleId, rules.length);
    rules.push({
      id: ruleId,
      name: getIssueTypeTitle(type),
      shortDescription: { text: getIssueTypeTitle(type) },
    });
  }

  const results: SarifResult[] = [];

  for (const [type, isReportType] of Object.entries(report) as Entries<Report>) {
    if (!isReportType) continue;

    const ruleId = `knip/${type}`;
    const ruleIndex = ruleIndexMap.get(ruleId) ?? 0;

    for (const issue of flattenIssues(issues[type] as IssueRecords)) {
      if (type === 'duplicates' && issue.symbols) {
        for (const symbol of issue.symbols) {
          results.push(
            createResult({
              ruleId,
              ruleIndex,
              issue,
              symbolName: symbol.symbol,
              line: symbol.line,
              col: symbol.col,
              cwd,
            })
          );
        }
      } else {
        results.push(
          createResult({
            ruleId,
            ruleIndex,
            issue,
            symbolName: issue.symbol,
            line: issue.line,
            col: issue.col,
            cwd,
          })
        );
      }
    }
  }

  const sarif: SarifLog = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'knip',
            informationUri: 'https://knip.dev',
            version: '1.0.0',
            rules,
          },
        },
        originalUriBaseIds: {
          SRCROOT: { uri: `file://${cwd.replace(/\\/g, '/')}` },
        },
        results,
      },
    ],
  };

  const output = JSON.stringify(sarif, null, 2);

  // See: https://github.com/nodejs/node/issues/6379
  // @ts-expect-error _handle is private
  process.stdout._handle?.setBlocking?.(true);
  process.stdout.write(`${output}\n`);
};

function createResult({
  ruleId,
  ruleIndex,
  issue,
  symbolName,
  line,
  col,
  cwd,
}: {
  ruleId: string;
  ruleIndex: number;
  issue: Issue;
  symbolName: string;
  line?: number;
  col?: number;
  cwd: string;
}): SarifResult {
  const uri = toRelative(issue.filePath, cwd);
  const prefix = getIssuePrefix(issue.type);

  const result: SarifResult = {
    ruleId,
    ruleIndex,
    level: convertSeverity(issue.severity),
    message: {
      text: `${prefix}: ${symbolName}${issue.parentSymbol ? ` (${issue.parentSymbol})` : ''}`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: uri.replace(/\\/g, '/'),
            uriBaseId: 'SRCROOT',
          },
          ...(line !== undefined && {
            region: {
              startLine: line,
              ...(col !== undefined && { startColumn: col }),
            },
          }),
        },
      },
    ],
    partialFingerprints: {
      issueHash: createHash('md5')
        .update(`${uri}:${line ?? ''}:${col ?? ''}:${symbolName}`)
        .digest('hex'),
    },
  };

  return result;
}

function convertSeverity(severity?: IssueSeverity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    default:
      return 'note';
  }
}
