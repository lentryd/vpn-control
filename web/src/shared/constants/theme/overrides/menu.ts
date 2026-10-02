// Adapted from remnawave/frontend (AGPL-3.0)
import { Combobox, Menu } from '@mantine/core'

const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default {
    Menu: Menu.extend({
        defaultProps: {
            shadow: 'lg',
            withArrow: false,
            radius: 'md',
            transitionProps: {
                transition: 'fade',
                duration: 180,
                timingFunction: 'ease-out'
            },
            styles: {
                dropdown: {
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    border: '1px solid var(--mantine-color-dark-4)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)'
                },
                divider: {
                    borderColor: 'var(--mantine-color-dark-5)',
                    margin: '4px 0'
                }
            }
        }
    }),
    Combobox: Combobox.extend({
        defaultProps: {
            transitionProps: { transition: 'fade', duration: 200 },
            // On phones the on-screen keyboard resizes the viewport while
            // the dropdown is open: flipping above/below and hiding when
            // the input is briefly "detached" made it flicker.
            ...(touch && { middlewares: { flip: false, shift: true }, hideDetached: false })
        }
    })
}
