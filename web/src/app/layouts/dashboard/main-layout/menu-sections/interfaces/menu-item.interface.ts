// Adapted from remnawave/frontend (AGPL-3.0)
import { ElementType } from 'react'

export interface MenuItem {
    header?: string
    icon?: ElementType
    id?: string
    section: {
        dropdownItems?: {
            href: string
            icon?: ElementType
            id: string
            name: string
        }[]
        href: string
        icon: ElementType
        id: string
        name: string
        newTab?: boolean
    }[]
}
