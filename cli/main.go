package main

import (
	"os"

	"github.com/nebioudaniel/HULU_Code/cli/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
