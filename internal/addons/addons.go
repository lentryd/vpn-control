// Package addons reads an add-ons file in subpage's addons.yml format — the
// file subpage uses to append add-on users (prefix+<username>+suffix) to
// subscriptions — so a shared file keeps both catalogs in step. Add-ons can
// also live in the UI only; Marshal writes the format back for the API.
package addons

import (
	"errors"
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Addon is an addons.yml entry.
type Addon struct {
	Name            string            `yaml:"name" json:"name"`
	Prefix          string            `yaml:"prefix" json:"prefix"`
	Suffix          string            `yaml:"suffix,omitempty" json:"suffix,omitempty"`
	Remark          string            `yaml:"remark,omitempty" json:"remark,omitempty"`
	RemarkUnlimited string            `yaml:"remarkUnlimited,omitempty" json:"remarkUnlimited,omitempty"`
	Stubs           map[string]string `yaml:"stubs,omitempty" json:"stubs,omitempty"`
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

// File is the whole add-ons file.
type File struct {
	Addons []Addon `yaml:"addons" json:"addons"`
}

// Marshal renders add-ons as an addons.yml.
func Marshal(list []Addon) ([]byte, error) {
	return yaml.Marshal(File{Addons: list})
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
	var f File
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
