import { ISSUE_TYPE_TITLE, SYMBOL_TYPE } from '../../constants.ts';
import type { Issue, IssueRecords, IssueSeverity, IssueSortBy, IssueSymbol, IssueType } from '../../types/issues.ts';
import st from '../../util/colors.ts';
import { relative } from '../../util/path.ts';
import { Table } from '../../util/table.ts';

const plain = (text: string) => text;
export const dim = st.gray;
export const bright = st.whiteBright;

export const getIssueTypeTitle = (reportType: keyof typeof ISSUE_TYPE_TITLE) => ISSUE_TYPE_TITLE[reportType];

export const getColoredTitle = (title: string, count: number) =>
  `${st.style(['yellowBright', 'underline'], title)} (${count})`;

export const getDimmedTitle = (title: string, count: number) => `${st.yellow(`${st.underline(title)} (${count})`)}`;

type LogIssueLine = {
  owner?: string;
  filePath: string;
  symbols?: IssueSymbol[];
  parentSymbol?: string;
  severity?: IssueSeverity;
};

export const getIssueLine = ({ owner, filePath, symbols, parentSymbol, severity }: LogIssueLine, cwd: string) => {
  const symbol = symbols ? `: ${symbols.map(s => s.symbol).join(', ')}` : '';
  const parent = parentSymbol ? ` (${parentSymbol})` : '';
  const print = severity === 'warn' ? dim : plain;
  return `${owner ? `${st.cyan(owner)} ` : ''}${print(`${relative(cwd, filePath)}${symbol}${parent}`)}`;
};

export const convert = (issue: Issue | IssueSymbol) => ({
  namespace: 'parentSymbol' in issue ? issue.parentSymbol : undefined,
  name: issue.symbol,
  line: issue.line,
  col: issue.col,
  pos: issue.pos,
});

const sortByPos = (a: Issue, b: Issue) => {
  if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
  if (a.line !== b.line) return (a.line ?? 0) - (b.line ?? 0);
  return (a.col ?? 0) - (b.col ?? 0);
};

export type IssueComparator = (a: Issue, b: Issue) => number;

const ISSUE_SORT_VALUES: readonly IssueSortBy[] = ['severity', 'file', 'symbol'];

export const isIssueSortBy = (value: string): value is IssueSortBy =>
  (ISSUE_SORT_VALUES as readonly string[]).includes(value);

const severityRank = (severity?: IssueSeverity) =>
  severity === 'error' ? 0 : severity === 'warn' ? 1 : severity === 'off' ? 2 : 3;

export const getIssueComparator = (sortBy: IssueSortBy | undefined): IssueComparator | undefined => {
  switch (sortBy) {
    case 'severity':
      return (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        a.filePath.localeCompare(b.filePath) ||
        a.symbol.localeCompare(b.symbol);
    case 'file':
      return (a, b) => a.filePath.localeCompare(b.filePath) || a.symbol.localeCompare(b.symbol);
    case 'symbol':
      return (a, b) => a.symbol.localeCompare(b.symbol) || a.filePath.localeCompare(b.filePath);
    default:
      return undefined;
  }
};

const highlightSymbol =
  (issue: Issue) =>
  (_: unknown): string => {
    const { specifier, symbol } = issue;
    if (specifier && specifier !== symbol) {
      const idx = specifier.indexOf(symbol);
      if (idx !== -1) {
        return `${dim(specifier.slice(0, idx))}${bright(symbol)}${dim(specifier.slice(idx + symbol.length))}`;
      }
    }
    return symbol;
  };

export const getTableForType = (
  issues: Issue[],
  cwd: string,
  options: { isUseColors?: boolean; comparator?: IssueComparator } = { isUseColors: true }
) => {
  const table = new Table({ truncate: { filePath: 'start', symbolType: 'none' } });

  for (const issue of issues.sort(options.comparator ?? sortByPos)) {
    table.row();

    const print = options.isUseColors && (issue.isFixed || issue.severity === 'warn') ? dim : plain;

    const isFileIssue = issue.type === 'files';
    const symbol = issue.symbols ? issue.symbols.map(s => s.symbol).join(', ') : issue.symbol;
    if (!isFileIssue) table.cell('symbol', print(symbol), options.isUseColors ? highlightSymbol(issue) : () => symbol);

    table.cell('parentSymbol', issue.parentSymbol && print(issue.parentSymbol));
    table.cell('symbolType', issue.symbolType && issue.symbolType !== SYMBOL_TYPE.UNKNOWN && print(issue.symbolType));

    const pos = issue.line === undefined ? '' : `:${issue.line}${issue.col === undefined ? '' : `:${issue.col}`}`;
    const filePath = relative(cwd, issue.filePath);
    const cell = isFileIssue ? filePath : `${filePath}${pos}`;
    table.cell('filePath', print(cell));

    table.cell('fixed', issue.isFixed && print('(removed)'));
  }

  return table;
};

export const flattenIssues = (issues: IssueRecords): Issue[] => Object.values(issues).flatMap(Object.values);

export const getIssuePrefix = (type: IssueType) => ISSUE_TYPE_TITLE[type].replace(/ies$/, 'y').replace(/s$/, '');
