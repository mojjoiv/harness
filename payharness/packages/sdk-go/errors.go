package payharness

import "fmt"

// Error represents a structured PayHarness API error.
type Error struct {
	Status    int
	RequestID string
	Details   map[string]any
	Message   string
}

func (e *Error) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("PayHarness request failed (status %d)", e.Status)
}
