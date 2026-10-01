// Adapted from remnawave/frontend (AGPL-3.0)
// oxlint-disable
import { Modal } from '@mantine/core'


import classes from './modal.module.css'

export default {
    Modal: Modal.extend({
        classNames: {
            root: classes.modalRoot,
            header: classes.modalHeader,
            body: classes.modalBody,
            content: classes.modalContent
        },
        defaultProps: {
            transitionProps: { transition: 'fade', duration: 200 },
            radius: 'md',
            centered: true
        }
    })
}
