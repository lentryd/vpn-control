// SearchSelect is a searchable Select. On phones a floating dropdown under
// a focused input fights the on-screen keyboard (the viewport shrinks and
// scrolls, the dropdown jumps), so there the field opens a full-screen
// picker instead: a search box with a plain list below, nothing floating.
import {
    type ComboboxItem,
    type ComboboxItemGroup,
    Modal,
    ScrollArea,
    Select,
    type SelectProps,
    Stack,
    Text,
    TextInput,
    UnstyledButton
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { type ReactNode, useState } from 'react'
import { PiCheck, PiMagnifyingGlass, PiX } from 'react-icons/pi'
import { TbSelector } from 'react-icons/tb'

import { BaseOverlayHeader } from '../overlays/base-overlay-header'

// Any of: a finger as the primary pointer, no hover, or a phone-wide screen.
// Some Android browsers report a fine pointer, so pointer alone misses them.
// Read synchronously so the first render already picks the right field.
const TOUCH_QUERY = '(pointer: coarse), (hover: none), (max-width: 48em)'
export const useTouch = () => useMediaQuery(TOUCH_QUERY, undefined, { getInitialValueInEffect: false }) ?? false

// On touch a floating dropdown must stay under its field: flipping and
// shifting chase the viewport as the keyboard opens and the list jumps.
export const touchComboboxProps = { position: 'bottom', middlewares: { flip: false, shift: false } } as const

export type SearchSelectProps = Omit<SelectProps, 'searchable'>

const item = (i: string | ComboboxItem): ComboboxItem => (typeof i === 'string' ? { value: i, label: i } : i)

const flatten = (data: SelectProps['data']) =>
    (data ?? []).flatMap((d) =>
        typeof d === 'object' && 'group' in d
            ? (d as ComboboxItemGroup<string | ComboboxItem>).items.map((i) => ({ ...item(i), group: d.group }))
            : [{ ...item(d as string | ComboboxItem), group: '' }]
    )

export function SearchSelect(props: SearchSelectProps) {
    const touch = useTouch()
    if (!touch) return <Select searchable {...props} />
    return <TouchSelect {...props} />
}

function TouchSelect({ data, value, onChange, renderOption, nothingFoundMessage, clearable, label, placeholder, disabled, ...rest }: SearchSelectProps) {
    const [opened, { open, close }] = useDisclosure(false)
    const [query, setQuery] = useState('')
    const items = flatten(data)
    const q = query.trim().toLowerCase()
    const found = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items
    const pick = (v: ComboboxItem | null) => {
        onChange?.(v?.value ?? null, v as ComboboxItem)
        setQuery('')
        close()
    }

    let lastGroup: string = ''
    return (
        <>
            <Select
                {...rest}
                data={data}
                disabled={disabled}
                label={label}
                onClick={() => !disabled && open()}
                placeholder={placeholder}
                readOnly
                rightSection={<TbSelector size={16} />}
                rightSectionPointerEvents="none"
                styles={{ input: { cursor: 'pointer' } }}
                value={value ?? null}
            />
            <Modal
                fullScreen
                onClose={close}
                opened={opened}
                title={<BaseOverlayHeader IconComponent={PiMagnifyingGlass} iconColor="cyan" title={typeof label === 'string' ? label : 'Выбор'} />}
                zIndex={400}
            >
                <Stack gap="sm">
                    <TextInput
                        data-autofocus
                        leftSection={<PiMagnifyingGlass size={16} />}
                        onChange={(e) => setQuery(e.currentTarget.value)}
                        placeholder="Поиск"
                        // 16px keeps iOS from zooming in on focus
                        styles={{ input: { fontSize: 16 } }}
                        value={query}
                    />
                    <ScrollArea.Autosize mah="calc(100dvh - 160px)" type="auto">
                        <Stack gap={2}>
                            {clearable && value && (
                                <Row checked={false} onClick={() => pick(null)}>
                                    <Text c="dimmed" size="sm">
                                        <PiX size={14} style={{ verticalAlign: -2 }} /> Очистить
                                    </Text>
                                </Row>
                            )}
                            {found.length === 0 && (
                                <Text c="dimmed" p="sm" size="sm">
                                    {nothingFoundMessage ?? 'Ничего не найдено'}
                                </Text>
                            )}
                            {found.map((i) => {
                                const header = i.group && String(i.group) !== lastGroup ? String(i.group) : null
                                lastGroup = String(i.group ?? '')
                                const checked = i.value === value
                                return (
                                    <div key={i.value}>
                                        {header && (
                                            <Text c="dimmed" fw={600} pt="sm" px="sm" size="xs" tt="uppercase">
                                                {header}
                                            </Text>
                                        )}
                                        <Row checked={checked} disabled={i.disabled} onClick={() => pick(i)}>
                                            {renderOption ? renderOption({ option: i, checked }) : <Text size="sm">{i.label}</Text>}
                                        </Row>
                                    </div>
                                )
                            })}
                        </Stack>
                    </ScrollArea.Autosize>
                </Stack>
            </Modal>
        </>
    )
}

function Row({ checked, disabled, onClick, children }: { checked: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <UnstyledButton
            disabled={disabled}
            onClick={onClick}
            px="sm"
            py={10}
            style={{
                borderRadius: 'var(--mantine-radius-md)',
                background: checked ? 'rgba(45, 212, 191, 0.08)' : undefined,
                border: `1px solid ${checked ? 'rgba(45, 212, 191, 0.2)' : 'transparent'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: disabled ? 0.5 : 1
            }}
            w="100%"
        >
            <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
            {checked && <PiCheck color="var(--mantine-color-teal-5)" size={16} />}
        </UnstyledButton>
    )
}
