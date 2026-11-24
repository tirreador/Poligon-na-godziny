import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export function createRepo({ dir, fetchUrl, pushUrl, branch = "main", sshKey }) {
  const home = path.join(path.dirname(dir), "git-home");
  let env = process.env;
  let queue = Promise.resolve();

  async function git(...args) {
    const { stdout } = await run("git", args, { cwd: dir, env, maxBuffer: 64 * 1024 * 1024 });
    return stdout.trim();
  }

  return {
    async init() {
      await mkdir(home, { recursive: true });
      env = { ...process.env, HOME: home, GIT_TERMINAL_PROMPT: "0" };
      if (sshKey) {
        const keyFile = path.join(home, "deploy_key");
        await writeFile(keyFile, sshKey.endsWith("\n") ? sshKey : `${sshKey}\n`, { mode: 0o600 });
        env.GIT_SSH_COMMAND = `ssh -i ${keyFile} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${path.join(home, "known_hosts")}`;
      }
      try {
        await access(path.join(dir, ".git"));
      } catch {
        await run("git", ["clone", "--depth", "1", "--branch", branch, fetchUrl, dir], { env });
      }
      if (pushUrl) await git("remote", "set-url", "--push", "origin", pushUrl);
      await git("config", "user.name", "Panel Poligon na Godziny");
      await git("config", "user.email", "panel@poligon-na-godziny.invalid");
    },

    async sync() {
      await git("fetch", "--depth", "1", "origin", branch);
      await git("reset", "--hard", `origin/${branch}`);
    },

    async commitAndPush(paths, message) {
      await git("add", "-A", "--", ...paths);
      try {
        await git("diff", "--cached", "--quiet");
        return false;
      } catch {
        await git("commit", "-m", message);
        await git("push", "origin", `HEAD:${branch}`);
        return true;
      }
    },

    exclusive(task) {
      const next = queue.then(task, task);
      queue = next.catch(() => {});
      return next;
    }
  };
}
