import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import internalReporters from '../reporters/index.ts';
import type { ReporterOptions } from '../types/issues.ts';
import { _load } from './loader.ts';
import { isAbsolute, isInternal, resolve } from './path.ts';

export const runPreprocessors = async (processors: string[], data: ReporterOptions): Promise<ReporterOptions> => {
  const preprocessors = await Promise.all(
    processors.map(proc => _load(isInternal(proc) && !isAbsolute(proc) ? resolve(proc) : proc))
  );
  return preprocessors.length === 0
    ? Promise.resolve(data)
    : runPreprocessors(preprocessors.slice(1), preprocessors[0](data));
};

export const runReporters = async (reporter: string[], options: ReporterOptions, outputPath?: string) => {
  const reporters = await Promise.all(
    reporter.map(async reporter => {
      return reporter in internalReporters
        ? internalReporters[reporter as keyof typeof internalReporters]
        : await _load(isInternal(reporter) && !isAbsolute(reporter) ? resolve(reporter) : reporter);
    })
  );

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    const stream = createWriteStream(outputPath, { encoding: 'utf-8' });

    const originalConsoleLog = console.log;
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);

    console.log = (...args: unknown[]) => {
      stream.write(args.join(' ') + '\n');
    };

    process.stdout.write = ((chunk: unknown, encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void), callback?: (err?: Error | null) => void) => {
      if (typeof encodingOrCallback === 'function') {
        callback = encodingOrCallback;
        encodingOrCallback = undefined;
      }
      const data = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf-8';
      stream.write(data, encoding, callback as (err?: Error | null) => void);
      return true;
    }) as typeof process.stdout.write;

    try {
      for (const reporter of reporters) await reporter(options);
    } finally {
      console.log = originalConsoleLog;
      process.stdout.write = originalStdoutWrite;
      await new Promise<void>((resolve, reject) => {
        stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
      });
    }
  } else {
    for (const reporter of reporters) await reporter(options);
  }
};
