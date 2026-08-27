/** ANSI color helpers for terminal output. */
const c = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  green: "\x1b[32m",
  red:   "\x1b[31m",
  yellow:"\x1b[33m",
  cyan:  "\x1b[36m",
  blue:  "\x1b[34m",
  magenta:"\x1b[35m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgRed:   "\x1b[41m",
  bgYellow:"\x1b[43m"
};

type StatusBadge = "SUCCESS" | "FAILED" | "PARTIAL" | "CANCELLED" | "healthy" | "degraded" | "unhealthy" | string;

export class CliFormatter {

  static badge(status: StatusBadge): string {
    const badges: Record<string, string> = {
      SUCCESS:   `${c.bgGreen}${c.bold} SUCCESS  ${c.reset}`,
      FAILED:    `${c.bgRed}${c.bold}  FAILED   ${c.reset}`,
      PARTIAL:   `${c.bgYellow}${c.bold} PARTIAL  ${c.reset}`,
      CANCELLED: `${c.bgYellow}${c.bold} CANCELLED${c.reset}`,
      healthy:   `${c.green}● healthy${c.reset}`,
      degraded:  `${c.yellow}● degraded${c.reset}`,
      unhealthy: `${c.red}● unhealthy${c.reset}`
    };
    return badges[status] ?? `${c.dim}[${status}]${c.reset}`;
  }

  static header(title: string): void {
    const line = "═".repeat(60);
    console.log(`\n${c.cyan}${c.bold}${line}${c.reset}`);
    console.log(`${c.cyan}${c.bold}  ${title}${c.reset}`);
    console.log(`${c.cyan}${c.bold}${line}${c.reset}\n`);
  }

  static kv(label: string, value: string | number | boolean | undefined, color = c.white): void {
    const val = value === undefined ? `${c.dim}—${c.reset}` : `${color}${value}${c.reset}`;
    console.log(`  ${c.dim}${label.padEnd(22)}${c.reset} ${val}`);
  }

  static table(headers: string[], rows: string[][]): void {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => String(r[i] ?? "").length))
    );
    const sep = "─".repeat(widths.reduce((a, w) => a + w + 3, 1));
    const fmt = (row: string[], dim = false) => {
      const prefix = dim ? c.dim : "";
      return "│ " + row.map((cell, i) => `${prefix}${String(cell).padEnd(widths[i])}${c.reset}`).join(" │ ") + " │";
    };

    console.log(`  ┌${sep}┐`);
    console.log(`  ${fmt(headers)}`);
    console.log(`  ├${sep}┤`);
    rows.forEach(row => console.log(`  ${fmt(row, true)}`));
    console.log(`  └${sep}┘`);
  }

  static separator(): void {
    console.log(`\n${c.dim}${"─".repeat(60)}${c.reset}\n`);
  }

  static success(msg: string): void { console.log(`${c.green}✔ ${msg}${c.reset}`); }
  static error(msg: string): void   { console.log(`${c.red}✘ ${msg}${c.reset}`); }
  static info(msg: string): void    { console.log(`${c.cyan}ℹ ${msg}${c.reset}`); }
  static warn(msg: string): void    { console.log(`${c.yellow}⚠ ${msg}${c.reset}`); }

  static spinner(msg: string): () => void {
    const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
    let i = 0;
    const timer = setInterval(() => {
      process.stdout.write(`\r${c.cyan}${frames[i++ % frames.length]}${c.reset} ${msg}`);
    }, 80);
    return () => { clearInterval(timer); process.stdout.write("\r\x1b[K"); };
  }
}
