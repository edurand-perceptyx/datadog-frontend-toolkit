import * as readline from 'readline';

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
}

export function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface();
  const suffix = defaultValue ? ` (${defaultValue})` : '';

  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

export function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface();

    // Mute stdout to hide input
    const stdout = process.stderr;
    let value = '';

    stdout.write(`  ${question}: `);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (char: string): void => {
      const c = char.toString();

      if (c === '\n' || c === '\r' || c === '\u0004') {
        // Enter or EOF
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        stdout.write('\n');
        rl.close();
        resolve(value);
      } else if (c === '\u0003') {
        // Ctrl+C
        stdout.write('\n');
        process.exit(1);
      } else if (c === '\u007F' || c === '\b') {
        // Backspace
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        value += c;
        stdout.write('*');
      }
    };

    process.stdin.on('data', onData);
  });
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await prompt(`${question} [${hint}]`);

  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

export async function select(question: string, options: string[], defaultIndex = 0): Promise<string> {
  // eslint-disable-next-line no-console
  console.error(`  ${question}`);
  for (let i = 0; i < options.length; i++) {
    const marker = i === defaultIndex ? '›' : ' ';
    // eslint-disable-next-line no-console
    console.error(`    ${marker} ${i + 1}) ${options[i]}`);
  }
  const answer = await prompt('Choose', String(defaultIndex + 1));
  const index = parseInt(answer, 10) - 1;
  return options[index] ?? options[defaultIndex];
}

export async function selectOrCustom(question: string, options: string[], defaultIndex = 0): Promise<string> {
  const customLabel = 'Other (enter custom value)';
  // eslint-disable-next-line no-console
  console.error(`  ${question}`);
  for (let i = 0; i < options.length; i++) {
    const marker = i === defaultIndex ? '›' : ' ';
    // eslint-disable-next-line no-console
    console.error(`    ${marker} ${i + 1}) ${options[i]}`);
  }
  // eslint-disable-next-line no-console
  console.error(`      ${options.length + 1}) ${customLabel}`);

  const answer = await prompt('Choose', String(defaultIndex + 1));
  const index = parseInt(answer, 10) - 1;

  if (index === options.length) {
    return prompt('Enter custom value');
  }

  return options[index] ?? options[defaultIndex];
}
