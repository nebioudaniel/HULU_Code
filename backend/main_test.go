package main

import "testing"

const knownAnswerKey = "hulu_sk_knownAnswerVector0000000000000"
const knownAnswerHash = "bc51bf94c0e755747ec71bce5a74b3c2fbac2d5398b554e4ca3821b7e6251a1d"

func TestHashApiKeyKnownAnswer(t *testing.T) {
	if got := hashApiKey(knownAnswerKey); got != knownAnswerHash {
		t.Fatalf("hashApiKey(%q) = %q, want %q", knownAnswerKey, got, knownAnswerHash)
	}
}
