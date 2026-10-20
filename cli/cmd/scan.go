package cmd

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/nebioudaniel/HULU_Code/cli/internal/analyze"
	"github.com/nebioudaniel/HULU_Code/cli/internal/api"
	"github.com/nebioudaniel/HULU_Code/cli/internal/config"
	"github.com/nebioudaniel/HULU_Code/cli/internal/project"
	"github.com/nebioudaniel/HULU_Code/cli/internal/version"
)

func newScanCmd() *cobra.Command {
	var (
		local       bool
		asJSON      bool
		verbose     bool
		symbols     bool
		includeCode bool
		langFilter  string
		doSync      bool
		name        string
		assumeYes   bool
		dryRun      bool
	)

	scan := &cobra.Command{
		Use:   "scan --local [path]",
		Short: "Scan a directory on this machine and report the code it would read",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if !local {
				return errors.New("Only local scans are supported right now. Pass --local.")
			}

			saved, err := requireLogin()
			if err != nil {
				return err
			}

			if includeCode && !asJSON {
				return errors.New("--include-code needs --json, so the source only appears in that output.")
			}
			if dryRun && !doSync {
				return errors.New("--dry-run needs --sync.")
			}
			if (assumeYes || name != "") && !doSync {
				return errors.New("--name and --yes need --sync.")
			}
			if doSync && asJSON {
				return errors.New("Use --sync or --json, not both.")
			}
			if doSync && includeCode {
				return errors.New("--include-code cannot be combined with --sync.")
			}
			if doSync && symbols {
				return errors.New("--symbols cannot be combined with --sync.")
			}

			languages, err := analyze.ParseLanguages(langFilter)
			if err != nil {
				return err
			}

			path := "."
			if len(args) == 1 {
				path = args[0]
			}

			result, err := analyze.Run(path, analyze.Options{Languages: languages})
			if err != nil {
				return err
			}

			if doSync {
				return runSync(cmd, saved, result, path, name, assumeYes, dryRun)
			}

			out := cmd.OutOrStdout()

			if asJSON {
				if includeCode {
					fmt.Fprintln(cmd.ErrOrStderr(), "Source code is included in this output.")
				}
				return result.WriteJSON(out, includeCode)
			}

			fmt.Fprintln(out, "Nothing is uploaded by this command. Files stay on your machine.")
			result.WriteText(out, verbose)
			if symbols {
				result.WriteSymbols(out)
			}

			return nil
		},
	}

	scan.Flags().BoolVar(&local, "local", false, "Scan a directory on this machine")
	scan.Flags().BoolVar(&asJSON, "json", false, "Print the report as JSON")
	scan.Flags().BoolVar(&verbose, "verbose", false, "List every file that was parsed")
	scan.Flags().BoolVar(&symbols, "symbols", false, "List the symbols found in every file")
	scan.Flags().BoolVar(&includeCode, "include-code", false, "Include chunk source code in the JSON output")
	scan.Flags().StringVar(&langFilter, "lang", "", "Only parse these languages, for example go,ts,py")
	scan.Flags().BoolVar(&doSync, "sync", false, "Upload a structural summary of this project")
	scan.Flags().StringVar(&name, "name", "", "Project name to save (defaults to the folder name)")
	scan.Flags().BoolVar(&assumeYes, "yes", false, "Skip the sync consent prompt")
	scan.Flags().BoolVar(&dryRun, "dry-run", false, "Show what would be sent without sending it")

	return scan
}

func runSync(
	cmd *cobra.Command,
	saved *config.Config,
	result *analyze.Result,
	path string,
	name string,
	assumeYes bool,
	dryRun bool,
) error {
	meta, err := buildMeta(path, name)
	if err != nil {
		return err
	}

	payload := project.Build(result, meta, version.Version)
	apiURL := saved.ResolveAPIURL()

	if dryRun {
		size, err := api.CompressedSize(payload)
		if err != nil {
			return err
		}

		out := cmd.OutOrStdout()
		fmt.Fprintln(out, "Dry run: nothing was sent.")
		fmt.Fprintf(out, "  Project: %s\n", meta.Name)
		fmt.Fprintf(out, "  Files: %d\n", len(payload.Files))
		fmt.Fprintf(out, "  Chunks: %d\n", len(payload.Chunks))
		fmt.Fprintf(out, "  Edges: %d\n", len(payload.Edges))
		fmt.Fprintf(out, "  Payload: %s (gzipped)\n", humanSize(size))

		if raw, err := json.Marshal(payload); err == nil && len(raw) > 1000000 {
			fmt.Fprintln(out, "Large project: syncing a subfolder is faster")
		}

		return nil
	}

	if !saved.SyncConsent && !assumeYes {
		if !stdinIsTerminal() {
			return errors.New("This project is not approved for syncing yet. Run again with --yes to allow it.")
		}

		approved, err := confirmSync(cmd, meta.Name, apiURL)
		if err != nil {
			return err
		}
		if !approved {
			return errors.New("Sync cancelled.")
		}

		saved.SyncConsent = true
		if err := saved.Save(); err != nil {
			return err
		}
	}

	fmt.Fprintf(cmd.ErrOrStderr(), "Syncing %s...\n", meta.Name)

	res, err := api.NewClient(apiURL).Sync(cmd.Context(), saved.APIKey, payload)
	if err != nil {
		return describeSyncFailure(err, apiURL)
	}

	out := cmd.OutOrStdout()
	fmt.Fprintf(out, "Synced %s\n", meta.Name)
	fmt.Fprintf(out, "  Files: %d\n", res.Files)
	fmt.Fprintf(out, "  Chunks: %d\n", res.Chunks)
	fmt.Fprintf(out, "  Edges: %d\n", res.Edges)
	fmt.Fprintf(out, "View it at %s%s\n", apiURL, res.URL)

	return nil
}

func buildMeta(path string, name string) (project.Meta, error) {
	rootHash, err := project.RootHash(path)
	if err != nil {
		return project.Meta{}, err
	}

	label := strings.TrimSpace(name)
	if label == "" {
		label = project.Name(path)
	}
	if len(label) > 80 {
		label = label[:80]
	}

	return project.Meta{Name: label, RootHash: rootHash}, nil
}

func requireLogin() (*config.Config, error) {
	saved, err := loadSavedConfig()
	if err != nil {
		return nil, err
	}

	if saved.APIKey == "" {
		return nil, errors.New("You are not logged in. Run `hulucode auth login --key <KEY>` first.")
	}

	return saved, nil
}

func confirmSync(cmd *cobra.Command, name string, apiURL string) (bool, error) {
	errOut := cmd.ErrOrStderr()

	fmt.Fprintf(errOut, "\nSync \"%s\" to %s?\n\n", name, apiURL)
	fmt.Fprintln(errOut, "It will send:")
	fmt.Fprintln(errOut, "  - relative file paths")
	fmt.Fprintln(errOut, "  - symbol names and kinds")
	fmt.Fprintln(errOut, "  - line numbers")
	fmt.Fprintln(errOut, "  - import relationships between your files")
	fmt.Fprintln(errOut, "  - names of external packages you depend on")
	fmt.Fprintln(errOut, "  - the project name")
	fmt.Fprintln(errOut)
	fmt.Fprintln(errOut, "It will NOT send:")
	fmt.Fprintln(errOut, "  - any source code or file contents")
	fmt.Fprintln(errOut, "  - absolute paths")
	fmt.Fprintln(errOut, "  - files named like secrets or credentials")
	fmt.Fprintln(errOut)
	fmt.Fprint(errOut, "Sync this project now? [y/N]: ")

	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return false, fmt.Errorf("could not read your answer: %w", err)
	}

	answer := strings.ToLower(strings.TrimSpace(line))

	return answer == "y" || answer == "yes", nil
}

func describeSyncFailure(err error, apiURL string) error {
	limitErr := &api.LimitError{}
	if errors.As(err, &limitErr) {
		return fmt.Errorf("%s\nUpgrade your plan at %s/select-plan", limitErr.Message, apiURL)
	}

	apiErr := &api.APIError{}
	if errors.As(err, &apiErr) {
		if apiErr.StatusCode == http.StatusUnauthorized {
			return errors.New("Your API key was rejected. Run `hulucode auth login` again.")
		}
		if apiErr.StatusCode == http.StatusRequestEntityTooLarge {
			return errors.New("This project is too large to sync in one go. Run the sync from a subfolder, for example: cd path/to/folder && hulucode scan --local --sync")
		}
		if apiErr.StatusCode == http.StatusServiceUnavailable {
			return errors.New(apiErr.Message)
		}
		return fmt.Errorf("Sync failed (HTTP %d)", apiErr.StatusCode)
	}

	networkErr := &api.NetworkError{}
	if errors.As(err, &networkErr) {
		return fmt.Errorf("Could not reach %s", apiURL)
	}

	return err
}

func stdinIsTerminal() bool {
	return term.IsTerminal(int(os.Stdin.Fd()))
}

func humanSize(bytes int) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}

	value := float64(bytes)
	units := []string{"KB", "MB", "GB"}
	for _, label := range units {
		value /= unit
		if value < unit {
			return fmt.Sprintf("%.1f %s", value, label)
		}
	}

	return fmt.Sprintf("%.1f TB", value/unit)
}
