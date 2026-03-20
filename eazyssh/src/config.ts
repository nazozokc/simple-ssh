import { readFile, writeFile, appendFile } from "fs/promises";
import { homedir } from "os";
import path from "path";

export interface SshHost {
  name: string;
  hostname?: string;
  user?: string;
  port?: string;
  identityFile?: string;
  extras: Record<string, string>;
}

const SSH_CONFIG_PATH = path.join(homedir(), ".ssh", "config");

export async function readSshConfig(): Promise<SshHost[]> {
  try {
    const content = await readFile(SSH_CONFIG_PATH, "utf-8");
    return parseSshConfig(content);
  } catch {
    return [];
  }
}

export function parseSshConfig(content: string): SshHost[] {
  const hosts: SshHost[] = [];
  const lines = content.split("\n");
  let currentHost: SshHost | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const hostMatch = trimmed.match(/^Host\s+(.+)$/i);
    if (hostMatch) {
      const name = hostMatch[1].trim();
      if (name === "*") continue;
      if (currentHost) hosts.push(currentHost);
      currentHost = { name, extras: {} };
      continue;
    }

    if (currentHost) {
      const keyMatch = trimmed.match(/^(\w+)\s+(.+)$/);
      if (keyMatch) {
        const [, key, value] = keyMatch;
        const lowerKey = key.toLowerCase();
        switch (lowerKey) {
          case "hostname":
            currentHost.hostname = value.trim();
            break;
          case "user":
            currentHost.user = value.trim();
            break;
          case "port":
            currentHost.port = value.trim();
            break;
          case "identityfile":
            currentHost.identityFile = value.trim();
            break;
          default:
            currentHost.extras[lowerKey] = value.trim();
        }
      }
    }
  }

  if (currentHost) hosts.push(currentHost);
  return hosts;
}

export async function appendHostToConfig(host: SshHost): Promise<void> {
  const lines = [
    "",
    `Host ${host.name}`,
  ];
  if (host.hostname) lines.push(`    HostName ${host.hostname}`);
  if (host.user) lines.push(`    User ${host.user}`);
  if (host.port) lines.push(`    Port ${host.port}`);
  if (host.identityFile) lines.push(`    IdentityFile ${host.identityFile}`);
  for (const [key, value] of Object.entries(host.extras)) {
    lines.push(`    ${key} ${value}`);
  }

  await appendFile(SSH_CONFIG_PATH, lines.join("\n") + "\n", "utf-8");
}

export async function removeHostFromConfig(name: string): Promise<boolean> {
  const content = await readFile(SSH_CONFIG_PATH, "utf-8");
  const lines = content.split("\n");
  const result: string[] = [];
  let insideTarget = false;
  let found = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith("host ")) {
      const hostName = trimmed.split(/\s+/)[1];
      if (hostName === name) {
        insideTarget = true;
        found = true;
        continue;
      } else {
        insideTarget = false;
      }
    }
    if (!insideTarget) {
      result.push(line);
    }
  }

  await writeFile(SSH_CONFIG_PATH, result.join("\n") + "\n", "utf-8");
  return found;
}

export function formatHostLabel(host: SshHost): string {
  const name = host.name.padEnd(20);
  const userHost = host.user
    ? `${host.user}@${host.hostname || host.name}`
    : (host.hostname || host.name);
  const port = host.port ? `:${host.port}` : "";
  return `${name} ${userHost}${port}`;
}
