# hulucode CLI

`hulucode` talks to your huluCode instance from the terminal. Scanning happens entirely on your machine: the `scan` command reads files and prints a report, and nothing is uploaded yet.

## Install

Requires Go 1.22 or newer.

```sh
cd cli
make build
```

That writes a `hulucode` binary next to the source. To put it on your `PATH`:

```sh
make install
```

`make install` builds into `$(go env GOPATH)/bin`. If that folder is not on your `PATH` yet:

```sh
export PATH="$PATH:$(go env GOPATH)/bin"
```

`make install` is used instead of `go install .` because the module path ends in `/cli`, so a plain `go install` would name the binary `cli`. The Makefile builds it explicitly as `hulucode`.

Other targets: `make test`, `make vet`, `make fmt`, `make clean`.

## Configuration

Settings live in `~/.hulucode/config.json`, written with permissions `0600` inside a `0700` directory:

```json
{
  "api_key": "hulu_sk_...",
  "api_url": "http://localhost:3000"
}
```

The API URL is chosen in this order:

1. the `HULUCODE_API_URL` environment variable
2. `api_url` in the config file
3. the default `http://localhost:3000`

The full API key is never printed. Commands show the first 12 characters followed by `...`, for example `hulu_sk_abc1...`.

## Commands

### Log in

```sh
hulucode auth login --key hulu_sk_...
```

Validates the key against `POST /api/v1/auth/validate` (10 second timeout), then saves it.

- Success prints `Logged in. Plan: <plan>`.
- A rejected key prints the server message and exits with code `1`.
- An unreachable server prints `Could not reach <api_url>` and exits with code `1`.
- Keys must start with `hulu_sk_`.

Leave off `--key` to type the key in:

```sh
hulucode auth login
```

The key is read from the terminal without echoing it. When stdin is a pipe the value is read from the pipe, so this also works:

```sh
pbpaste | hulucode auth login
```

### Check status

```sh
hulucode auth status
```

Re-validates the saved key and prints the masked key, the plan and the API URL. Prints `Not logged in.` when no key is saved.

### Log out

```sh
hulucode auth logout
```

Deletes the saved key from the config file.

### Scan a local project

```sh
hulucode scan --local
hulucode scan --local ./some/project
hulucode scan --local --json
hulucode scan --local --verbose
```

The path defaults to the current directory. Logging in is required, but nothing is uploaded — the command walks the tree and reports what it would read.

Flags:

- `--json` prints the report as JSON instead of a table.
- `--verbose` lists every file that was kept.

Exit code is `0` on success.

## What is skipped, and why

### Directories that are never entered

These are build output, dependencies and tool caches. Reading them would be slow and pointless:

`.git`, `node_modules`, `vendor`, `.next`, `dist`, `build`, `out`, `target`, `__pycache__`, `.venv`, `venv`, `.idea`, `.vscode`, `coverage`

### Files that are never read

Secret and credential files are skipped even when they are not in `.gitignore`, because they should never leave your machine:

`.env` and `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cer`, `id_rsa*`, `id_ed25519*`, `*.keystore`, `credentials*`, `secrets*`, `.npmrc`, `.netrc`

They are counted in the `secret` row but their contents are never opened.

### Other rules

- `.gitignore` files are respected, including nested ones. Patterns are matched relative to the `.gitignore` that defines them.
- Only source files are kept: `.go`, `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.py`.
- Files larger than 1 MB are skipped.
- Files containing a NUL byte in the first 8 KB are treated as binary and skipped.
- Symbolic links are never followed.

### Skip reasons in the report

- `ignored` — matched a `.gitignore` rule
- `secret` — a secret or credential file
- `too_large` — over 1 MB
- `binary` — contains a NUL byte in the first 8 KB
- `unsupported` — not one of the source extensions above
- `symlink` — a symbolic link, never followed

## How the numbers are counted

- A file's line count is the number of newline characters, plus one when the file does not end with a newline.
- Pruned directories (the list above, and directories excluded by `.gitignore`) are not walked, so files inside them are not counted in the skip table. Only files that were actually considered appear in the counts.
