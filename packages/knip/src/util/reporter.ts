import internalReporters from '../reporters/index.ts';
import type { ReporterOptions } from '../types/issues.ts';
import { writeFile } from './fs.ts';
import { _load } from './loader.ts';
import { isAbsolute, isInternal, resolve, toAbsolute, toPosix } from './path.ts';

export const runPreprocessors = async (processors: string[], data: ReporterOptions): Promise<ReporterOptions> => {
  const preprocessors = await Promise.all(
    processors.map(proc => _load(isInternal(proc) && !isAbsolute(proc) ? resolve(proc) : proc))
  );
  return preprocessors.length === 0
    ? Promise.resolve(data)
    : runPreprocessors(preprocessors.slice(1), preprocessors[0](data));
};

export const runReporters = async (reporter: string[], options: ReporterOptions, outputFile?: string) => {
  const reporters = await Promise.all(
    reporter.map(async reporter => {
      return reporter in internalReporters
        ? internalReporters[reporter as keyof typeof internalReporters]
        : await _load(isInternal(reporter) && !isAbsolute(reporter) ? resolve(reporter) : reporter);
    })
  );

  if (outputFile) {
    const chunks: Array<string> = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array, encoding?: unknown, callback?: unknown): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      const cb = typeof encoding === 'function' ? encoding : callback;
      if (typeof cb === 'function') (cb as (error?: Error) => void)();
      return true;
    }) as typeof process.stdout.write;

    try {
      for (const reporter of reporters) await reporter(options);
    } finally {
      process.stdout.write = originalWrite;
    }

    await writeFile(toAbsolute(toPosix(outputFile), options.cwd), chunks.join(''));
    return;
  }

  for (const reporter of reporters) await reporter(options);
};
