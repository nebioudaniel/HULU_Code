BINARY := hulucode
PACKAGES := ./...

GOBIN := $(shell go env GOBIN)
ifeq ($(GOBIN),)
GOBIN := $(shell go env GOPATH)/bin
endif

.PHONY: build test vet fmt install clean

build:
	go build -o $(BINARY) .

test:
	go test $(PACKAGES)

vet:
	go vet $(PACKAGES)

fmt:
	gofmt -w .

install:
	go build -o "$(GOBIN)/$(BINARY)" .

clean:
	rm -f $(BINARY)
