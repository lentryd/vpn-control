// SearchSelect is a searchable Select with an inline dropdown, as in the
// panel. Keeping it steady under the phone keyboard is the Combobox theme's job.
import { Select, type SelectProps } from '@mantine/core'

export type SearchSelectProps = Omit<SelectProps, 'searchable'>

export function SearchSelect(props: SearchSelectProps) {
    return <Select searchable {...props} />
}
