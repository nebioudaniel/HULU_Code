package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/nebioudaniel/HULU_Code/cli/internal/api"
	"github.com/nebioudaniel/HULU_Code/cli/internal/config"
)

func NewRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:           "hulucode",
		Short:         "Understand any codebase without your code leaving your machine",
		Long:          "hulucode keeps your source on your machine. Log in once, then scan a project to see exactly what would be read.",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	root.AddCommand(newAuthCmd(), newScanCmd())

	return root
}

func Execute() error {
	root := NewRootCmd()
	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return err
	}

	return nil
}

func describeAuthFailure(err error, apiURL string) error {
	apiErr := &api.APIError{}
	if errors.As(err, &apiErr) {
		return errors.New(apiErr.Message)
	}

	networkErr := &api.NetworkError{}
	if errors.As(err, &networkErr) {
		return fmt.Errorf("Could not reach %s", apiURL)
	}

	return err
}

func loadSavedConfig() (*config.Config, error) {
	saved, err := config.Load()
	if err != nil && !errors.Is(err, config.ErrNotConfigured) {
		return nil, err
	}

	return saved, nil
}
