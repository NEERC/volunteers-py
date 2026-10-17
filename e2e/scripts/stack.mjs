// Runs the e2e stack (mock, backend, UI) in the foreground for manual testing
// on the data left by the test runs. Stop with Ctrl+C.
import { spawn } from "node:child_process";
import { MOCK_URL, services, UI_URL } from "../stack.config.mjs";

const children = services.map(({ name, command, cwd, env }) => {
  const child = spawn(command, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${name}] `;
  const pipe = (stream, out) =>
    stream.on("data", (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (line) out.write(`${prefix}${line}\n`);
      }
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`${prefix}exited with code ${code}`);
    shutdown();
  });
  return child;
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 1000);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  `UI: ${UI_URL}\nMock ITMO ID login accepts any username, users of the runs are in e2e/.state/users.json\nTelegram notifications: ${MOCK_URL}/__mock/telegram/messages`,
);
