import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "CLI install",
  description:
    "Install the hulucode CLI, log in with an API key, and scan a local project without uploading anything.",
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600">
        {children}
      </div>
    </section>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-800">
      <code>{children}</code>
    </pre>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-neutral-600">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export default function CliPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <article className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          CLI install
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          The hulucode CLI connects your machine to hulucode. Scanning runs
          locally: it reads files and reports what it would use, and nothing is
          uploaded while scanning.
        </p>

        <Section title="Install">
          <p>Build from source (requires Go 1.22+, plus Xcode Command Line Tools on macOS or gcc and Go 1.22+ on Linux):</p>
          <Code>{`git clone https://github.com/nebioudaniel/HULU_Code.git
cd HULU_Code/cli
make build
cp hulucode ~/.local/bin/hulucode`}</Code>
          <p>
            Make sure {`~/.local/bin`} is on your {`PATH`}, then open a new
            terminal:
          </p>
          <Code>{`export PATH="$PATH:$HOME/.local/bin"`}</Code>
        </Section>

        <Section title="Log in">
          <p>
            Create an API key on the API keys page, then hand it to the CLI.
            Keys start with {`hulu_sk_`}.
          </p>
          <Code>{`hulucode auth login --api-url ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`}</Code>
          <p>
            The key is validated against the server before it is saved to{" "}
            {`~/.hulucode/config.json`}. The file is written with permissions{" "}
            {`0600`} inside a {`0700`} directory, and the full key is never
            printed again.
          </p>
          <p>
            The CLI prompts for the key with hidden input. To pass the key
            directly instead:
          </p>
          <Code>{`hulucode auth login --key hulu_sk_your_key`}</Code>
          <p>
            If the server cannot be reached you get a{" "}
            {`Could not reach <api_url>`} message, and a rejected key prints the
            server message. Both exit with code {`1`}.
          </p>
        </Section>

        <Section title="Check your session">
          <Code>{`hulucode auth status`}</Code>
          <p>
            Re-validates the saved key and prints the plan and the API URL. It
            shows only the first 12 characters of the key, like{" "}
            {`hulu_sk_abc1...`}. With no key saved it reports that you are not
            logged in. To remove the key:
          </p>
          <Code>{`hulucode auth logout`}</Code>
        </Section>

        <Section title="Scan a local project">
          <p>
            Scanning needs a saved key. By default it stays entirely on your
            machine. The path defaults to the current directory.
          </p>
          <Code>{`hulucode scan --local
hulucode scan --local ./some/project
hulucode scan --local --json
hulucode scan --local --verbose
hulucode scan --local --symbols
hulucode scan --local --lang go,ts,py
hulucode scan --local --json --include-code`}</Code>
          <Bullets
            items={[
              "--json prints the report as JSON instead of a table.",
              "--verbose lists every file that was parsed.",
              "--symbols prints per-file symbol lists (kind, name, line range).",
              "--lang filters by language, using a comma-separated list of go, ts, js, py.",
              "--include-code adds chunk source code to the JSON output and writes a notice to stderr.",
            ]}
          />
          <p>The report looks like this:</p>
          <Code>{`Kept 3 files (5 lines)

Language    Files
Go          1
Python      1
TypeScript  1

Skipped      Files
ignored      1
secret       1
too_large    0
binary       0
unsupported  2
symlink      0`}</Code>
        </Section>

        <Section title="Sync your project structure">
          <p>
            Add {`--sync`} to send the project structure to your dashboard so
            you can browse it on the web. Only structure is sent: relative
            file paths, symbol names and kinds, line numbers, import
            relationships and external package names. Your source code and
            file contents never leave your machine.
          </p>
          <Code>{`hulucode scan --local --sync
hulucode scan --local --sync --name "My Project"
hulucode scan --local --sync --dry-run
hulucode scan --local --sync --yes
hulucode scan --local --sync --include-readme`}</Code>
          <Bullets
            items={[
              "--sync uploads the project structure to your account.",
              "--name sets the project name (defaults to the directory name).",
              "--dry-run prints what would be sent, including the payload size, without sending anything.",
              "--yes approves the sync without the confirmation prompt.",
              "--include-readme uploads the project README (size, first 3 lines shown, confirmation prompt; use --yes to skip). The dashboard checkbox \"Include README\" must also be checked for AI questions to use it.",
            ]}
          />
          <p>
            The first time you sync a project, the CLI lists exactly what is
            sent and what is not, and asks for your consent. With {`--yes`} you
            approve for that run only. Without it, a non-interactive shell
            refuses to sync until you approve.
          </p>
        </Section>

        <Section title="Flags">
          <table className="mt-2 w-full text-sm text-muted-foreground">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="pb-2 font-medium text-foreground w-1/3">Flag</th>
                <th className="pb-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 font-mono text-xs">{`--local`}</td>
                <td className="py-2">Scan a directory on the local machine (required).</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--json`}</td>
                <td className="py-2">Print the report as JSON instead of a table.</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--include-code`}</td>
                <td className="py-2">Include chunk source code in JSON output (requires {`--json`}).</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--verbose`}</td>
                <td className="py-2">List every file that was parsed.</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--symbols`}</td>
                <td className="py-2">List symbols found in every file.</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--lang`}</td>
                <td className="py-2">Only parse these languages, for example {`go,ts,py`}.</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--sync`}</td>
                <td className="py-2">Upload the project structure to your dashboard.</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--name`}</td>
                <td className="py-2">Project name to save (defaults to the folder name).</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--yes`}</td>
                <td className="py-2">Skip the sync confirmation prompt.</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">{`--dry-run`}</td>
                <td className="py-2">Show what would be sent without sending it.</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted-foreground">
            Auth commands: {`hulucode auth login --key <KEY>`},{" "}
            {`hulucode auth login --api-url <URL>`} (prompts for the key with
            hidden input), {`hulucode auth status`}, and{" "}
            {`hulucode auth logout`}.
          </p>
        </Section>

        <Section title="What is skipped, and why">
          <p>These directories are never entered:</p>
          <Code>{`.git, node_modules, vendor, .next, dist, build, out, target,
__pycache__, .venv, venv, .idea, .vscode, coverage`}</Code>
          <p>
            These files are never read, even when they are not in{" "}
            {`.gitignore`}:
          </p>
          <Code>{`.env and .env.*, *.pem, *.key, *.p12, *.pfx, *.crt, *.cer,
id_rsa*, id_ed25519*, *.keystore, credentials*, secrets*, .npmrc, .netrc`}</Code>
          <p>They are counted, but their contents are never opened.</p>
          <Bullets
            items={[
              ".gitignore files are respected, including nested ones.",
              "Only source files are kept: .go, .ts, .tsx, .js, .jsx, .mjs, .py.",
              "Files over 1 MB are skipped.",
              "Files containing a NUL byte in the first 8 KB are treated as binary and skipped.",
              "Symbolic links are never followed.",
            ]}
          />
          <p>Each skip in the report has a reason:</p>
          <Bullets
            items={[
              "ignored - matched a .gitignore rule",
              "secret - a secret or credential file",
              "too_large - over 1 MB",
              "binary - contains a NUL byte in the first 8 KB",
              "unsupported - not one of the source file types",
              "symlink - a symbolic link, never followed",
            ]}
          />
        </Section>

        <Section title="Your code stays on your machine">
          <p>
            Scanning always happens locally. A plain {`hulucode scan --local`}{" "}
            reads your files, builds the report and uploads nothing. Adding{" "}
            {`--sync`} sends only the project structure, and only after you
            consent. Your source code is never sent.
          </p>
        </Section>
      </article>
    </section>
  )
}
