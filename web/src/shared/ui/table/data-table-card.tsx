// Adapted from remnawave/frontend (AGPL-3.0): table settings follow
// widgets/dashboard/users/users-table/user-table.widget.tsx.
import {
    MantineReactTable,
    MRT_ShowHideColumnsButton,
    MRT_ToggleDensePaddingButton,
    MRT_ToggleFullScreenButton,
    useMantineReactTable,
    type MRT_RowData,
    type MRT_TableOptions,
    type MRT_TableState,
    type MRT_Updater
} from '@kastov/mantine-react-table-open'
import { MRT_Localization_RU } from '@kastov/mantine-react-table-open/locales/ru/index.esm.mjs'
import { ActionIconGroup, Badge } from '@mantine/core'
import { ReactNode, useCallback, useEffect, useState } from 'react'

import { CardTitle } from './table.card-titile'
import { TableContainerShared } from './table.container.shared'
import { DataTableContent } from './table.table-content'

const TOOLBAR_BG = { '--mrt-base-background-color': '#1b2027' } as React.CSSProperties

type Persisted = Pick<
    MRT_TableState<MRT_RowData>,
    'columnOrder' | 'columnPinning' | 'columnSizing' | 'columnVisibility' | 'density' | 'sorting'
> & { pageSize: number }

function readPersisted(key: string): Partial<Persisted> {
    try {
        return JSON.parse(localStorage.getItem(`mrt:${key}`) ?? '{}')
    } catch {
        return {}
    }
}

// usePersisted keeps one piece of table state in localStorage, like the
// panel's mrt-table-store, so column layout survives reloads.
function usePersisted<K extends keyof Persisted>(key: string, field: K, initial: Persisted[K]) {
    const [value, setValue] = useState<Persisted[K]>(() => readPersisted(key)[field] ?? initial)

    useEffect(() => {
        try {
            const all = readPersisted(key)
            localStorage.setItem(`mrt:${key}`, JSON.stringify({ ...all, [field]: value }))
        } catch {
            // storage unavailable: state just isn't remembered
        }
    }, [key, field, value])

    const set = useCallback(
        (u: MRT_Updater<Persisted[K]>) =>
            setValue((prev) => (typeof u === 'function' ? (u as (p: Persisted[K]) => Persisted[K])(prev) : u)),
        []
    )
    return [value, set] as const
}

export interface DataTableCardProps<T extends MRT_RowData> extends MRT_TableOptions<T> {
    actions?: ReactNode
    // compact hides column filters and pagination, for short embedded lists
    compact?: boolean
    description?: ReactNode
    icon: ReactNode
    // onRowClick opens the entity, as row clicks do in the panel.
    onRowClick?: (row: T) => void
    // storageKey identifies the table for remembered layout.
    storageKey: string
    title: ReactNode
    toolbarActions?: ReactNode
}

export function DataTableCard<T extends MRT_RowData>(props: DataTableCardProps<T>) {
    const {
        actions,
        compact,
        description,
        icon,
        onRowClick,
        storageKey,
        title,
        toolbarActions,
        initialState,
        state,
        ...rest
    } = props

    const [columnOrder, setColumnOrder] = usePersisted(storageKey, 'columnOrder', [])
    const [columnPinning, setColumnPinning] = usePersisted(storageKey, 'columnPinning', {
        left: [],
        right: rest.enableRowActions ? ['mrt-row-actions'] : []
    })
    const [columnSizing, setColumnSizing] = usePersisted(storageKey, 'columnSizing', {})
    const [columnVisibility, setColumnVisibility] = usePersisted(
        storageKey,
        'columnVisibility',
        initialState?.columnVisibility ?? {}
    )
    const [density, setDensity] = usePersisted(storageKey, 'density', 'xs')
    const [sorting, setSorting] = usePersisted(storageKey, 'sorting', initialState?.sorting ?? [])
    const [pageSize, setPageSize] = usePersisted(storageKey, 'pageSize', 25)
    const [pageIndex, setPageIndex] = useState(0)

    const table = useMantineReactTable<T>({
        localization: MRT_Localization_RU,
        columnFilterDisplayMode: 'subheader',
        enableFacetedValues: true,
        enableFullScreenToggle: true,
        enableSortingRemoval: true,
        enableGlobalFilter: false,
        enableClickToCopy: false,
        enableColumnFilterModes: false,
        enableColumnOrdering: true,
        enableColumnResizing: true,
        enableColumnPinning: true,
        enableDensityToggle: true,
        enableStickyHeader: true,
        positionActionsColumn: 'last',
        paginationDisplayMode: 'pages',
        displayColumnDefOptions: {
            'mrt-row-actions': { header: '', size: 60, enableColumnOrdering: false }
        },
        mantineFilterTextInputProps: () => ({ placeholder: 'Фильтр…' }),
        mantineFilterSelectProps: ({ column }) => {
            const value = column.getFilterValue()
            return { clearable: value !== undefined && value !== null && value !== '' }
        },
        mantineFilterMultiSelectProps: ({ column }) => {
            const value = column.getFilterValue()
            const count = Array.isArray(value) ? value.length : 0
            return {
                clearable: count > 0,
                renderPill: () => null,
                ...(count > 0 && {
                    leftSection: <Badge variant="soft">{count}</Badge>,
                    placeholder: '',
                    clearSectionMode: 'clear'
                })
            }
        },
        mantineTopToolbarProps: { style: TOOLBAR_BG },
        mantineTableHeadProps: { style: TOOLBAR_BG },
        mantineBottomToolbarProps: { style: TOOLBAR_BG },
        mantinePaperProps: {
            style: { '--paper-radius': 'var(--mantine-radius-xs)' } as React.CSSProperties,
            withBorder: false
        },
        mantineTableContainerProps: { style: { maxHeight: compact ? undefined : 'calc(100dvh - 320px)' } },
        mantineTableBodyRowProps: onRowClick
            ? ({ row }) => ({
                  onClick: (e) => {
                      // clicks on buttons/menus inside the row keep their own behaviour
                      if ((e.target as HTMLElement).closest('button, a, input, [role="menuitem"]')) return
                      onRowClick(row.original)
                  },
                  style: { cursor: 'pointer' }
              })
            : undefined,
        renderToolbarInternalActions: ({ table: t }) => (
            <>
                {toolbarActions}
                <ActionIconGroup>
                    <MRT_ToggleDensePaddingButton table={t} />
                    <MRT_ToggleFullScreenButton table={t} />
                    <MRT_ShowHideColumnsButton table={t} />
                </ActionIconGroup>
            </>
        ),
        ...(compact && {
            enablePagination: false,
            enableBottomToolbar: false,
            enableColumnFilters: false,
            enableColumnActions: false,
            enableTopToolbar: false
        }),
        initialState: { showColumnFilters: !compact, ...initialState },
        onColumnOrderChange: setColumnOrder,
        onColumnPinningChange: setColumnPinning,
        onColumnSizingChange: setColumnSizing,
        onColumnVisibilityChange: setColumnVisibility,
        onDensityChange: setDensity,
        onSortingChange: setSorting,
        onPaginationChange: (u) => {
            const next = typeof u === 'function' ? u({ pageIndex, pageSize }) : u
            setPageIndex(next.pageIndex)
            setPageSize(next.pageSize)
        },
        ...rest,
        state: {
            ...(columnOrder.length > 0 && { columnOrder }),
            columnPinning,
            columnSizing,
            columnVisibility,
            density,
            sorting,
            pagination: compact ? { pageIndex: 0, pageSize: 1000 } : { pageIndex, pageSize },
            ...state
        }
    })

    return (
        <TableContainerShared>
            <CardTitle actions={actions} description={description} icon={icon} title={title} />
            <DataTableContent>
                <MantineReactTable table={table} />
            </DataTableContent>
        </TableContainerShared>
    )
}
