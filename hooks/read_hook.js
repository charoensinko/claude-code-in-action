const fs = require("fs");
const path = require("path");

const ENV_FILES = [".env", ".env.local", ".env.development", ".env.production"];

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

// Block reading a file/dir whose path itself names a .env file.
function pathTargetsEnv(ti) {
  return [ti.file_path, ti.path, ti.glob]
    .filter(Boolean)
    .some((p) => p.includes(".env"));
}

// Returns the list of existing .env files that fall within the Grep's search
// scope. With no `path`, Grep recurses the project root, so every .env counts.
function envFilesInScope(ti) {
  const root = projectRoot();
  const scope = path.resolve(root, ti.path || ".");
  return ENV_FILES.map((f) => path.resolve(root, f))
    .filter((envPath) => fs.existsSync(envPath))
    .filter(
      (envPath) =>
        envPath === scope || envPath.startsWith(scope + path.sep)
    );
}

// Block a Grep whose pattern would actually match a line inside a .env file.
function patternHitsEnv(ti) {
  if (!ti.pattern) return false;
  const envFiles = envFilesInScope(ti);
  if (envFiles.length === 0) return false;

  const flags = ti["-i"] ? "i" : "";
  let test;
  try {
    const re = new RegExp(ti.pattern, flags);
    test = (line) => re.test(line);
  } catch {
    // Invalid regex → fall back to a literal substring match.
    const needle = ti["-i"] ? ti.pattern.toLowerCase() : ti.pattern;
    test = (line) =>
      (ti["-i"] ? line.toLowerCase() : line).includes(needle);
  }

  for (const envPath of envFiles) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    if (lines.some(test)) return true;
  }
  return false;
}

process.stdin.setEncoding("utf8");
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const toolArgs = JSON.parse(input);
  const ti = toolArgs.tool_input || {};

  if (pathTargetsEnv(ti)) {
    console.error("You cannot read the .env file");
    process.exit(2);
  }
  if (patternHitsEnv(ti)) {
    console.error("That search would expose .env contents");
    process.exit(2);
  }
  process.exit(0);
});
