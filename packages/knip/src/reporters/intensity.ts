import type { DependencyIntensity } from '../types/issues.ts';
import st from '../util/colors.ts';
import type { MainOptions } from '../util/create-options.ts';
import { Table } from '../util/table.ts';

interface IntensityReporterOptions {
  report: DependencyIntensity[] | undefined;
  options: MainOptions;
}

export default ({ report }: IntensityReporterOptions) => {
  const intensity = report ?? [];

  console.log(st.whiteBright('\nDependency usage intensity'));

  if (intensity.length === 0) {
    console.log('No imported dependencies to report');
    return;
  }

  const table = new Table({ header: true });
  for (const item of intensity) {
    table.row();
    table.cell('dependency', item.isLowIntensity ? st.yellowBright(item.name) : st.cyan(item.name));
    table.cell('files', item.fileCount);
    table.cell('named exports', item.namedExportCount);
    table.cell('ratio', `${(item.fileRatio * 100).toFixed(1)}%`);
  }
  for (const line of table.toRows()) console.log(line);

  const lowIntensity = intensity.filter(item => item.isLowIntensity);
  if (lowIntensity.length > 0) {
    console.log();
    for (const item of lowIntensity) {
      console.log(
        st.yellow(
          `Low intensity: ${item.name} is referenced by ${item.fileCount} file(s) and ${item.namedExportCount} named export(s) — consider replacing it`
        )
      );
    }
  }
};
