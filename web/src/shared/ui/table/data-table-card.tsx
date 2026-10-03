import {
    MantineReactTable,
    MRT_ShowHideColumnsButton,
    MRT_ToggleDensePaddingButton,
    MRT_ToggleFiltersButton,
    MRT_ToggleFullScreenButton,
    useMantineReactTable,
    type MRT_RowData,
    type MRT_TableOptions,
    type MRT_TableState,
    type MRT_Updater
} from '@kastov/mantine-react-table-open'
import { MRT_Localization_EN } from '@kastov/mantine-react-table-open/locales/en/index.esm.mjs'
import { MRT_Localization_RU } from '@kastov/mantine-react-table-open/locales/ru/index.esm.mjs'
import { Badge, Group, Stack, Text } from '@mantine/core'
import { IconInbox, IconSearch } from '@tabler/icons-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CardTitle } from './table.card-titile'
import { TableContainerShared } from './table.container.shared'
import classes from './table.module.css'
import { DataTableContent } from './table.table-content'

type Persisted = Pick<
    MRT_TableState<MRT_RowData>,
    'columnOrder' | 'columnPinning' | 'columnSizing' | 'columnVisibility' | 'density' | 'sorting' | 'showColumnFilters'
> & { pageSize: number }

function readPersisted(key: string): Partial<Persisted> {
    try {
        return JSON.parse(localStorage.getItem(`mrt:${key}`) ?? '{}')
    } catch {
        return {}
    }
}

// usePersisted keeps one piece of table state in localStorage, so the
// column layout survives reloads.
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
        (u: MRT_Updater<Persisted[K]>) => setValue((prev) => (typeof u === 'function' ? (u as (p: Persisted[K]) => Persisted[K])(prev) : u)),
        []
    )
    return [value, set] as const
}

export interface DataTableCardProps<T extends MRT_RowData> extends MRT_TableOptions<T> {
    actions?: ReactNode
    // compact hides the toolbar, filters and pagination, for short embedded lists
    compact?: boolean
    description?: ReactNode
    // fill stretches the card to its parent's height (e.g. a grid cell)
    fill?: boolean
    icon?: ReactNode
    // onRowClick opens the entity
    onRowClick?: (row: T) => void
    // storageKey identifies the table for remembered layout
    storageKey: string
    title?: ReactNode
    toolbarActions?: ReactNode
}

// DataTableCard is a titled card around a mantine-react-table with search,
// optional column filters and a remembered column layout.
export function DataTableCard<T extends MRT_RowData>(props: DataTableCardProps<T>) {
    const { t, i18n } = useTranslation()
    const { actions, compact, description, fill, icon, onRowClick, storageKey, title, toolbarActions, initialState, state, ...rest } = props

    const [columnOrder, setColumnOrder] = usePersisted(storageKey, 'columnOrder', [])
    const [columnPinning, setColumnPinning] = usePersisted(storageKey, 'columnPinning', {
        left: [],
        right: rest.enableRowActions ? ['mrt-row-actions'] : []
    })
    const [columnSizing, setColumnSizing] = usePersisted(storageKey, 'columnSizing', {})
    const [columnVisibility, setColumnVisibility] = usePersisted(storageKey, 'columnVisibility', initialState?.columnVisibility ?? {})
    const [density, setDensity] = usePersisted(storageKey, 'density', 'xs')
    const [sorting, setSorting] = usePersisted(storageKey, 'sorting', initialState?.sorting ?? [])
    const [showColumnFilters, setShowColumnFilters] = usePersisted(storageKey, 'showColumnFilters', false)
    const [pageSize, setPageSize] = usePersisted(storageKey, 'pageSize', 25)
    const [pageIndex, setPageIndex] = useState(0)

    const table = useMantineReactTable<T>({
        localization: i18n.resolvedLanguage === 'ru' ? MRT_Localization_RU : MRT_Localization_EN,
        columnFilterDisplayMode: 'subheader',
        enableFacetedValues: true,
        enableFullScreenToggle: true,
        enableSortingRemoval: true,
        enableGlobalFilter: !compact,
        enableGlobalFilterRankedResults: false,
        globalFilterFn: 'contains',
        positionGlobalFilter: 'left',
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
        mantineSearchTextInputProps: {
            placeholder: t('common.filter'),
            leftSection: <IconSearch size={15} stroke={1.75} />,
            size: 'sm',
            className: classes.search,
            variant: 'default'
        },
        mantineFilterTextInputProps: () => ({ placeholder: t('common.filter'), size: 'xs' }),
        mantineFilterSelectProps: ({ column }) => {
            const value = column.getFilterValue()
            return { size: 'xs', clearable: value !== undefined && value !== null && value !== '' }
        },
        mantineFilterMultiSelectProps: ({ column }) => {
            const value = column.getFilterValue()
            const count = Array.isArray(value) ? value.length : 0
            return {
                size: 'xs',
                clearable: count > 0,
                renderPill: () => null,
                ...(count > 0 && {
                    leftSection: <Badge size="sm">{count}</Badge>,
                    placeholder: '',
                    clearSectionMode: 'clear'
                })
            }
        },
        mantinePaginationProps: { radius: 'md', size: 'sm', rowsPerPageOptions: ['10', '25', '50', '100'] },
        mantineTopToolbarProps: { className: classes.toolbar },
        mantinePaperProps: { withBorder: false, radius: 0, shadow: undefined },
        mantineTableProps: { highlightOnHover: false, striped: false, withColumnBorders: false, withTableBorder: false },
        mantineTableContainerProps: { style: { maxHeight: compact ? undefined : 'calc(100dvh - 300px)' } },
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
        renderToolbarInternalActions: ({ table: tb }) => (
            <Group gap={4} wrap="nowrap">
                {toolbarActions}
                <MRT_ToggleFiltersButton table={tb} />
                <MRT_ShowHideColumnsButton table={tb} />
                <MRT_ToggleDensePaddingButton table={tb} />
                <MRT_ToggleFullScreenButton table={tb} />
            </Group>
        ),
        ...(compact && {
            layoutMode: 'semantic',
            enableColumnResizing: false,
            enablePagination: false,
            enableBottomToolbar: false,
            enableColumnFilters: false,
            enableColumnActions: false,
            enableTopToolbar: false
        }),
        initialState: { showGlobalFilter: !compact, ...initialState },
        onColumnOrderChange: setColumnOrder,
        onColumnPinningChange: setColumnPinning,
        onColumnSizingChange: setColumnSizing,
        onColumnVisibilityChange: setColumnVisibility,
        onDensityChange: setDensity,
        onSortingChange: setSorting,
        onShowColumnFiltersChange: setShowColumnFilters,
        onPaginationChange: (u) => {
            const next = typeof u === 'function' ? u({ pageIndex, pageSize }) : u
            setPageIndex(next.pageIndex)
            setPageSize(next.pageSize)
        },
        renderEmptyRowsFallback: () => (
            <Stack align="center" className={classes.empty} gap={6}>
                <IconInbox color="var(--app-text-faint)" size={28} stroke={1.5} />
                <Text c="dimmed" size="sm">
                    {t('common.empty')}
                </Text>
            </Stack>
        ),
        ...rest,
        state: {
            ...(columnOrder.length > 0 && { columnOrder }),
            columnPinning: compact ? { left: [], right: [] } : columnPinning,
            columnSizing,
            columnVisibility,
            density,
            sorting,
            showColumnFilters: compact ? false : showColumnFilters,
            pagination: compact ? { pageIndex: 0, pageSize: 1000 } : { pageIndex, pageSize },
            ...state
        }
    })

    return (
        <TableContainerShared h={fill ? '100%' : undefined}>
            {title && <CardTitle actions={actions} description={description} icon={icon} title={title} />}
            <DataTableContent>
                <MantineReactTable table={table} />
            </DataTableContent>
        </TableContainerShared>
    )
}
