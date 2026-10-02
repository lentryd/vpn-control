// Package apperr is for errors users see: each has a stable Code the UI
// translates (filling in Params), an English Message used when it can't,
// and the HTTP status to answer with.
package apperr

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

type Error struct {
	Status int
	Code   string
	Params map[string]any
	// Message is English, with Params filled into {{name}} placeholders.
	Message string
	cause   error
}

func (e *Error) Error() string { return e.Message }
func (e *Error) Unwrap() error { return e.cause }

// New is a 400 error. kv are param name/value pairs, also filled into
// message's {{name}} placeholders.
func New(code, message string, kv ...any) *Error {
	return build(http.StatusBadRequest, code, message, nil, kv)
}

// Status is New with another HTTP status.
func Status(status int, code, message string, kv ...any) *Error {
	return build(status, code, message, nil, kv)
}

// Wrap adds context to err: its text becomes the "error" param. The
// status of a wrapped *Error is kept.
func Wrap(err error, code, message string, kv ...any) *Error {
	status := http.StatusBadRequest
	var inner *Error
	if errors.As(err, &inner) {
		status = inner.Status
	}
	return build(status, code, message, err, append(kv, "error", err.Error()))
}

func build(status int, code, message string, cause error, kv []any) *Error {
	e := &Error{Status: status, Code: code, Params: map[string]any{}, cause: cause}
	for i := 0; i+1 < len(kv); i += 2 {
		e.Params[fmt.Sprint(kv[i])] = kv[i+1]
	}
	for k, v := range e.Params {
		message = strings.ReplaceAll(message, "{{"+k+"}}", fmt.Sprint(v))
	}
	e.Message = message
	return e
}
