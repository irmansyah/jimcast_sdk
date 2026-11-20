// [plugin] __NAME__/src/shell.ts
//
// All state lives in files under ~/.jimcast/ext-__NAME__/ and every change is
// a shell script. The widget itself is stateless: render() re-reads the files.

import { pluginId, type ExecutionContext } from "@jimcast/sdk";

/** Single-quote a string for the shell. Use it for EVERY interpolated value. */
export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const DIR = `$HOME/.jimcast/plugin-data/${pluginId()}`;
const FILE = `"${DIR}/count"`;

export const INC_CMD = `mkdir -p "${DIR}"; n=$(cat ${FILE} 2>/dev/null || echo 0); echo $((n+1)) > ${FILE}`;
export const RESET_CMD = `mkdir -p "${DIR}"; echo 0 > ${FILE}`;

export async function readCount(ctx: ExecutionContext): Promise<number> {
  const res = await ctx.exec(`cat ${FILE} 2>/dev/null || echo 0`);
  return Number(res.stdout.trim()) || 0;
}
