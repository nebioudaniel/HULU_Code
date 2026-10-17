package cmd

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/nebioudaniel/HULU_Code/cli/internal/api"
	"github.com/nebioudaniel/HULU_Code/cli/internal/config"
)

const maxKeyInput = 4096

func newAuthCmd() *cobra.Command {
	auth := &cobra.Command{
		Use:   "auth",
		Short: "Manage the API key stored on this machine",
	}

	auth.AddCommand(newLoginCmd(), newStatusCmd(), newLogoutCmd())

	return auth
}

func newLoginCmd() *cobra.Command {
	var (
		providedKey string
		providedURL string
	)

	login := &cobra.Command{
		Use:   "login",
		Short: "Validate an API key and save it to your config",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			key := strings.TrimSpace(providedKey)
			if key == "" {
				entered, err := readSecret("Paste your API key: ")
				if err != nil {
					return err
				}
				key = strings.TrimSpace(entered)
			}

			if key == "" {
				return errors.New("No API key was provided.")
			}
			if !api.ValidKeyFormat(key) {
				return fmt.Errorf("That does not look like a huluCode key. Keys start with %q.", api.KeyPrefix)
			}

			saved, err := loadSavedConfig()
			if err != nil {
				return err
			}

			explicitURL := strings.TrimRight(strings.TrimSpace(providedURL), "/")

			apiURL := saved.ResolveAPIURL()
			if explicitURL != "" {
				apiURL = explicitURL
			}

			validation, err := api.NewClient(apiURL).Validate(cmd.Context(), key)
			if err != nil {
				return describeAuthFailure(err, apiURL)
			}

			saved.APIKey = key
			if explicitURL != "" {
				saved.APIURL = explicitURL
			}
			if err := saved.Save(); err != nil {
				return err
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Logged in. Plan: %s\n", validation.PlanTier)

			return nil
		},
	}

	login.Flags().StringVar(&providedKey, "key", "", "API key to validate and save")
	login.Flags().StringVar(&providedURL, "api-url", "", "API base URL to use and save in the config")

	return login
}

func newStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show the saved key, the plan and the API URL",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			saved, err := loadSavedConfig()
			if err != nil {
				return err
			}

			out := cmd.OutOrStdout()

			if saved.APIKey == "" {
				fmt.Fprintln(out, "Not logged in. Run `hulucode auth login` to sign in.")
				return nil
			}

			apiURL := saved.ResolveAPIURL()

			validation, err := api.NewClient(apiURL).Validate(cmd.Context(), saved.APIKey)
			if err != nil {
				return describeAuthFailure(err, apiURL)
			}

			fmt.Fprintln(out, "Logged in.")
			fmt.Fprintf(out, "Key: %s\n", config.MaskKey(saved.APIKey))
			fmt.Fprintf(out, "Plan: %s\n", validation.PlanTier)
			fmt.Fprintf(out, "API URL: %s\n", apiURL)

			return nil
		},
	}
}

func newLogoutCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Delete the saved API key",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := config.Clear(); err != nil {
				return err
			}

			fmt.Fprintln(cmd.OutOrStdout(), "Logged out.")

			return nil
		},
	}
}

func readSecret(prompt string) (string, error) {
	fmt.Fprint(os.Stderr, prompt)

	fd := int(os.Stdin.Fd())
	if term.IsTerminal(fd) {
		defer fmt.Fprintln(os.Stderr)

		entered, err := term.ReadPassword(fd)
		if err != nil {
			return "", fmt.Errorf("could not read the API key from the terminal: %w", err)
		}

		return string(entered), nil
	}

	fmt.Fprintln(os.Stderr)

	reader := bufio.NewReader(io.LimitReader(os.Stdin, maxKeyInput))
	line, err := reader.ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("could not read the API key from stdin: %w", err)
	}

	return line, nil
}
