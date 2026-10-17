package scanner

import (
	"fmt"
	"io"
	"sort"
	"text/tabwriter"
)

func (r *Report) WriteText(w io.Writer, verbose bool) {
	tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)

	fmt.Fprintf(tw, "Scanned\t%s\n\n", r.Root)
	fmt.Fprintf(tw, "Kept %d %s (%d lines)\n\n", r.Kept, plural(r.Kept, "file", "files"), r.TotalLines)

	fmt.Fprintln(tw, "Language\tFiles")
	for _, language := range sortedKeys(r.Languages) {
		fmt.Fprintf(tw, "%s\t%d\n", language, r.Languages[language])
	}
	fmt.Fprintln(tw)

	fmt.Fprintln(tw, "Skipped\tFiles")
	for _, reason := range ReasonOrder {
		fmt.Fprintf(tw, "%s\t%d\n", reason, r.Skipped[reason])
	}

	tw.Flush()

	if !verbose {
		return
	}

	fmt.Fprintln(w)
	if len(r.Files) == 0 {
		fmt.Fprintln(w, "No files were kept.")
		return
	}

	fmt.Fprintln(w, "Files kept")
	for _, file := range r.Files {
		fmt.Fprintf(w, "%s\t%d lines\n", file.Path, file.Lines)
	}
}

func sortedKeys(counts map[string]int) []string {
	keys := make([]string, 0, len(counts))
	for key := range counts {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func plural(count int, singular string, multiple string) string {
	if count == 1 {
		return singular
	}
	return multiple
}
