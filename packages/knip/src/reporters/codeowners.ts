import type { Entries } from '../types/entries.ts';
import type { Issue, IssueSortType, ReporterOptions } from '../types/issues.ts';
import { createOwnershipEngine } from '../util/codeowners.ts';
import { relative, resolve } from '../util/path.ts';
import { getColoredTitle, getIssueLine, getIssueTypeTitle, sortIssues } from './util/util.ts';

type OwnedIssue = Issue & { owner: string };

type ExtraReporterOptions = {
  path?: string;
};

const logIssueRecord = (issues: OwnedIssue[], cwd: string, sort?: IssueSortType) => {
  if (sort) {
    sortIssues(issues, sort);
  } else {
    issues.sort((a, b) => (a.owner < b.owner ? -1 : 1));
  }
  for (const { filePath, symbols, owner, parentSymbol } of issues) {
    console.log(getIssueLine({ owner, filePath, symbols, parentSymbol }, cwd));
  }
};

export default ({ report, issues, isShowProgress, options, cwd, sort }: ReporterOptions) => {
  let opts: ExtraReporterOptions = {};
  try {
    opts = options ? JSON.parse(options) : opts;
  } catch (error) {
    console.error(error);
  }
  const codeownersFilePath = resolve(opts.path ?? '.github/CODEOWNERS');
  const findOwners = createOwnershipEngine(codeownersFilePath);
  const reportMultipleGroups = Object.values(report).filter(Boolean).length > 1;
  const [dependenciesOwner = '[no-owner]'] = findOwners('package.json');
  let totalIssues = 0;

  const calcFileOwnership = (filePath: string) => findOwners(relative(cwd, filePath))[0] ?? dependenciesOwner;
  const addOwner = (issue: Issue) => ({
    ...issue,
    owner: calcFileOwnership(issue.filePath),
  });

  for (const [reportType, isReportType] of Object.entries(report) as Entries<typeof report>) {
    if (isReportType) {
      const title = reportMultipleGroups && getIssueTypeTitle(reportType);

      const issuesForType = Object.values(issues[reportType]).flatMap(issues => {
        if (reportType === 'duplicates') return Object.values(issues).map(addOwner);
        const symbols = Object.values(issues);
        return addOwner({ ...symbols[0], symbols });
      });

      if (issuesForType.length > 0) {
        if (totalIssues) console.log();
        title && console.log(getColoredTitle(title, issuesForType.length));
        logIssueRecord(issuesForType, cwd, sort);
      }

      totalIssues = totalIssues + issuesForType.length;
    }
  }

  if (totalIssues === 0 && isShowProgress) {
    console.log('✂️  Excellent, Knip found no issues.');
  }
};
