import fs from "node:fs";
import path from "node:path";
export default async function globalSetup() {
  fs.rmSync(path.join(process.cwd(), "data", "e2e"), { recursive: true, force: true });
}
