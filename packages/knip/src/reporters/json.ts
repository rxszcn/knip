import type { Entries } from '../types/entries.ts';
import type { IssueRecords, Report, ReporterOptions } from '../types/issues.ts';
import { createOwnershipEngine } from '../util/codeowners.ts';
import { isFile } from '../util/fs.ts';
import { relative, resolve } from '../util/path.ts';
import { convert, flattenIssues } from './util/util.ts';

type ExtraReporterOptions = {
  codeowners?: string;
};

export interface JSONReportNamedItem {
  name: string;
}

export interface JSONReportItem extends JSONReportNamedItem {
  namespace?: string;
  pos?: number;
  line?: number;
  col?: number;
}

export type JSONReportEntry = {
  file: string;
  owners?: Array<JSONReportNamedItem>;
  binaries?: Array<JSONReportNamedItem>;
  catalog?: Array<JSONReportItem>;
  dependencies?: Array<JSONReportItem>;
  devDependencies?: Array<JSONReportItem>;
  duplicates?: Array<Array<JSONReportItem>>;
  enumMembers?: Array<JSONReportItem>;
  exports?: Array<JSONReportItem>;
  files?: Array<JSONReportItem>;
  namespaceMembers?: Array<JSONReportItem>;
  nsExports?: Array<JSONReportItem>;
  nsTypes?: Array<JSONReportItem>;
  optionalPeerDependencies?: Array<JSONReportItem>;
  types?: Array<JSONReportItem>;
  unlisted?: Array<JSONReportNamedItem>;
  unresolved?: Array<JSONReportItem>;
};

export type JSONReport = {
  issues: Array<JSONReportEntry>;
};

export default async ({ report, issues, options, cwd, sort }: ReporterOptions) => {
  let opts: ExtraReporterOptions = {};
  try {
    opts = options ? JSON.parse(options) : opts;
  } catch (error) {
    console.error(error);
  }

  const json: Record<string, JSONReportEntry> = {};
  const codeownersFilePath = resolve(opts.codeowners ?? '.github/CODEOWNERS');
  const findOwners = isFile(codeownersFilePath) && createOwnershipEngine(codeownersFilePath);

  const initRow = (filePath: string) => {
    const file = relative(cwd, filePath);
    const row: JSONReportEntry = {
      file,
      ...(findOwners && { owners: findOwners(file).map(name => ({ name })) }),
      ...(report.binaries && { binaries: [] }),
      ...(report.catalog && { catalog: [] }),
      ...(report.dependencies && { dependencies: [] }),
      ...(report.devDependencies && { devDependencies: [] }),
      ...(report.duplicates && { duplicates: [] }),
      ...(report.enumMembers && { enumMembers: [] }),
      ...(report.exports && { exports: [] }),
      ...(report.files && { files: [] }),
      ...(report.namespaceMembers && { namespaceMembers: [] }),
      ...(report.nsExports && { nsExports: [] }),
      ...(report.nsTypes && { nsTypes: [] }),
      ...(report.optionalPeerDependencies && { optionalPeerDependencies: [] }),
      ...(report.types && { types: [] }),
      ...(report.unlisted && { unlisted: [] }),
      ...(report.unresolved && { unresolved: [] }),
    };
    return row;
  };

  for (const [type, isReportType] of Object.entries(report) as Entries<Report>) {
    if (isReportType) {
      for (const issue of flattenIssues(issues[type] as IssueRecords)) {
        const { filePath, symbol, symbols } = issue;
        json[filePath] = json[filePath] ?? initRow(filePath);
        if (type === 'duplicates') {
          symbols && json[filePath][type]?.push(symbols.map(convert));
        } else if (type === 'binaries') {
          json[filePath][type]?.push({ name: symbol });
        } else {
          json[filePath][type]?.push(convert(issue));
        }
      }
    }
  }

  const jsonReport: JSONReport = { issues: Object.values(json) };

  if (sort === 'file') {
    jsonReport.issues.sort((a, b) => a.file.localeCompare(b.file));
  } else if (sort === 'symbol') {
    for (const entry of jsonReport.issues) {
      for (const key of Object.keys(entry) as (keyof JSONReportEntry)[]) {
        const value = entry[key];
        if (Array.isArray(value)) {
          value.sort((a: { name?: string }, b: { name?: string }) =>
            (a.name ?? '').localeCompare(b.name ?? '')
          );
        }
      }
    }
  } else if (sort === 'severity') {
    jsonReport.issues.sort((a, b) => a.file.localeCompare(b.file));
  }
  const output = JSON.stringify(jsonReport);

  // See: https://github.com/nodejs/node/issues/6379
  // @ts-expect-error _handle is private
  process.stdout._handle?.setBlocking?.(true);
  process.stdout.write(`${output}\n`);
};
