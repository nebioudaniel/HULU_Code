package analyze

import "strings"

var nodeBuiltins = map[string]bool{
	"assert":              true,
	"async_hooks":         true,
	"buffer":              true,
	"child_process":       true,
	"cluster":             true,
	"console":             true,
	"constants":           true,
	"crypto":              true,
	"dgram":               true,
	"diagnostics_channel": true,
	"dns":                 true,
	"domain":              true,
	"events":              true,
	"fs":                  true,
	"http":                true,
	"http2":               true,
	"https":               true,
	"inspector":           true,
	"module":              true,
	"net":                 true,
	"os":                  true,
	"path":                true,
	"perf_hooks":          true,
	"process":             true,
	"punycode":            true,
	"querystring":         true,
	"readline":            true,
	"repl":                true,
	"stream":              true,
	"string_decoder":      true,
	"sys":                 true,
	"timers":              true,
	"tls":                 true,
	"trace_events":        true,
	"tty":                 true,
	"url":                 true,
	"util":                true,
	"v8":                  true,
	"vm":                  true,
	"wasi":                true,
	"worker_threads":      true,
	"zlib":                true,
}

var pythonStdlib = map[string]bool{
	"_thread":         true,
	"abc":             true,
	"argparse":        true,
	"array":           true,
	"ast":             true,
	"asyncio":         true,
	"base64":          true,
	"binascii":        true,
	"bisect":          true,
	"builtins":        true,
	"bz2":             true,
	"calendar":        true,
	"cmath":           true,
	"collections":     true,
	"colorsys":        true,
	"concurrent":      true,
	"configparser":    true,
	"contextlib":      true,
	"contextvars":     true,
	"copy":            true,
	"csv":             true,
	"ctypes":          true,
	"dataclasses":     true,
	"datetime":        true,
	"decimal":         true,
	"difflib":         true,
	"dis":             true,
	"email":           true,
	"enum":            true,
	"errno":           true,
	"faulthandler":    true,
	"fnmatch":         true,
	"fractions":       true,
	"functools":       true,
	"gc":              true,
	"getpass":         true,
	"gettext":         true,
	"glob":            true,
	"graphlib":        true,
	"gzip":            true,
	"hashlib":         true,
	"heapq":           true,
	"hmac":            true,
	"html":            true,
	"http":            true,
	"importlib":       true,
	"inspect":         true,
	"io":              true,
	"ipaddress":       true,
	"itertools":       true,
	"json":            true,
	"keyword":         true,
	"linecache":       true,
	"locale":          true,
	"logging":         true,
	"lzma":            true,
	"mailbox":         true,
	"marshal":         true,
	"math":            true,
	"mimetypes":       true,
	"mmap":            true,
	"multiprocessing": true,
	"netrc":           true,
	"numbers":         true,
	"operator":        true,
	"optparse":        true,
	"os":              true,
	"pathlib":         true,
	"pickle":          true,
	"pkgutil":         true,
	"platform":        true,
	"plistlib":        true,
	"pprint":          true,
	"profile":         true,
	"pty":             true,
	"queue":           true,
	"random":          true,
	"re":              true,
	"readline":        true,
	"reprlib":         true,
	"resource":        true,
	"runpy":           true,
	"secrets":         true,
	"select":          true,
	"selectors":       true,
	"shlex":           true,
	"shutil":          true,
	"signal":          true,
	"smtplib":         true,
	"socket":          true,
	"socketserver":    true,
	"sqlite3":         true,
	"ssl":             true,
	"stat":            true,
	"statistics":      true,
	"string":          true,
	"stringprep":      true,
	"struct":          true,
	"subprocess":      true,
	"sys":             true,
	"sysconfig":       true,
	"tarfile":         true,
	"tempfile":        true,
	"textwrap":        true,
	"threading":       true,
	"time":            true,
	"timeit":          true,
	"token":           true,
	"tokenize":        true,
	"tomllib":         true,
	"traceback":       true,
	"tracemalloc":     true,
	"types":           true,
	"typing":          true,
	"unicodedata":     true,
	"unittest":        true,
	"urllib":          true,
	"uuid":            true,
	"venv":            true,
	"warnings":        true,
	"wave":            true,
	"weakref":         true,
	"wsgiref":         true,
	"xml":             true,
	"xmlrpc":          true,
	"zipfile":         true,
	"zipimport":       true,
	"zlib":            true,
	"zoneinfo":        true,
}

func isStandardLibrary(language string, spec string) bool {
	switch language {
	case "Go":
		return isGoStandard(spec)
	case "TypeScript", "JavaScript":
		return isScriptStandard(spec)
	case "Python":
		return isPythonStandard(spec)
	}

	return false
}

func isGoStandard(spec string) bool {
	first := firstSegment(spec)

	return first != "" && !strings.Contains(first, ".")
}

func isScriptStandard(spec string) bool {
	if strings.HasPrefix(spec, "node:") {
		return true
	}
	if spec == "" || strings.HasPrefix(spec, ".") || strings.HasPrefix(spec, "/") || strings.HasPrefix(spec, "@") {
		return false
	}

	return nodeBuiltins[firstSegment(spec)]
}

func isPythonStandard(spec string) bool {
	if spec == "" || strings.HasPrefix(spec, ".") {
		return false
	}

	name := spec
	if index := strings.IndexAny(spec, "./"); index >= 0 {
		name = spec[:index]
	}

	return pythonStdlib[name]
}

func firstSegment(spec string) string {
	if index := strings.Index(spec, "/"); index >= 0 {
		return spec[:index]
	}

	return spec
}
