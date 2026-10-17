package cmd

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/nebioudaniel/HULU_Code/cli/internal/scanner"
)

func newScanCmd() *cobra.Command {
	var (
		local   bool
		asJSON  bool
		verbose bool
	)

	scan := &cobra.Command{
		Use:   "scan --local [path]",
		Short: "Scan a directory on this machine and report what would be read",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if !local {
				return errors.New("Only local scans are supported right now. Pass --local.")
			}

			if err := requireLogin(); err != nil {
				return err
			}

			path := "."
			if len(args) == 1 {
				path = args[0]
			}

			report, err := scanner.Scan(path)
			if err != nil {
				return err
			}

			out := cmd.OutOrStdout()

			if asJSON {
				encoder := json.NewEncoder(out)
				encoder.SetIndent("", "  ")
				return encoder.Encode(report)
			}

			fmt.Fprintln(out, "Nothing is uploaded by this command. Files stay on your machine.")
			fmt.Fprintln(out)
			report.WriteText(out, verbose)

			return nil
		},
	}

	scan.Flags().BoolVar(&local, "local", false, "Scan a directory on this machine")
	scan.Flags().BoolVar(&asJSON, "json", false, "Print the report as JSON")
	scan.Flags().BoolVar(&verbose, "verbose", false, "List every file that was kept")

	return scan
}

func requireLogin() error {
	saved, err := loadSavedConfig()
	if err != nil {
		return err
	}

	if saved.APIKey == "" {
		return errors.New("You are not logged in. Run `hulucode auth login --key <KEY>` first.")
	}

	return nil
}
