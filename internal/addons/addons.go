// Package addons reads subpage's addons.yml — the same file subpage uses to
// append add-on users (prefix+<username>+suffix) to subscriptions — so the
// add-on catalog here always matches what subpage serves.
package addons

import (
	"errors"
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Addon is the subset of an addons.yml entry we need.
type Addon struct {
	Name   string `yaml:"name"`
	Prefix string `yaml:"prefix"`
	Suffix string `yaml:"suffix"`
}

// DisplayName is Name, defaulting to Prefix+Suffix like subpage does.
func (a Addon) DisplayName() string {
	if a.Name != "" {
		return a.Name
	}
	return a.Prefix + a.Suffix
}

// Username is the add-on user's name for the main user's username.
func (a Addon) Username(main string) string { return a.Prefix + main + a.Suffix }

type file struct {
	Addons []Addon `yaml:"addons"`
}

// Load reads the file. A missing file (or a directory, which is what Docker
// creates for a bind mount whose source doesn't exist) means no add-ons.
func Load(path string) ([]Addon, error) {
	if fi, err := os.Stat(path); err == nil && fi.IsDir() {
		return nil, nil
	}
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var f file
	if err := yaml.Unmarshal(b, &f); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	out := f.Addons[:0]
	for _, a := range f.Addons {
		if a.Prefix == "" && a.Suffix == "" {
			continue
		}
		out = append(out, a)
	}
	return out, nil
}
