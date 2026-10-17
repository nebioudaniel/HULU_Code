package cmd

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/nebioudaniel/HULU_Code/cli/internal/analyze"
)

func newScanCmd() *cobra.Command {
	var (
		local       bool
		asJSON      bool
		verbose     bool
		symbols     bool
		includeCode bool
		langFilter  string
	)

	scan := &cobra.Command{
		Use:   "scan --local [path]",
		Short: "Scan a directory on this machine and report the code it would read",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if !local {
				return errors.New("Only local scans are supported right now. Pass --local.")
			}

			if err := requireLogin(); err != nil {
				return err
			}

			if includeCode && !asJSON {
				return errors.New("--include-code needs --json, so the source only appears in that output.")
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
