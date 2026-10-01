// Adapted from remnawave/frontend (AGPL-3.0)
import {
    Autocomplete,
    InputBase,
    InputWrapper,
    MultiSelect,
    NumberInput,
    PasswordInput,
    Select,
    Textarea,
    TextInput
} from '@mantine/core'
import { DateInput, DatePickerInput, DateTimePicker } from '@mantine/dates'

// Descriptions go under the input so fields side by side in a grid stay
// aligned when only one of them has a hint.
const field: { radius: 'md'; inputWrapperOrder: ('label' | 'input' | 'description' | 'error')[] } = {
    radius: 'md',
    inputWrapperOrder: ['label', 'input', 'description', 'error']
}

export default {
    // the panel renders every field label at weight 500
    InputWrapper: InputWrapper.extend({
        styles: {
            label: { fontWeight: 500 },
            description: { marginTop: 4 }
        }
    }),
    InputBase: InputBase.extend({ defaultProps: field }),
    PasswordInput: PasswordInput.extend({ defaultProps: field }),
    TextInput: TextInput.extend({ defaultProps: field }),
    Textarea: Textarea.extend({ defaultProps: field }),
    Autocomplete: Autocomplete.extend({ defaultProps: field }),
    MultiSelect: MultiSelect.extend({ defaultProps: field }),
    Select: Select.extend({
        defaultProps: { ...field, allowDeselect: false }
    }),
    NumberInput: NumberInput.extend({
        defaultProps: { ...field, thousandSeparator: ' ', decimalSeparator: ',' }
    }),
    DateInput: DateInput.extend({ defaultProps: field }),
    DatePickerInput: DatePickerInput.extend({ defaultProps: field }),
    DateTimePicker: DateTimePicker.extend({ defaultProps: field })
}
