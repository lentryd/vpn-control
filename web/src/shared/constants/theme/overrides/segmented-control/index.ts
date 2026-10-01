// Adapted from remnawave/frontend (AGPL-3.0)
import { SegmentedControl } from '@mantine/core'

import classes from './segmented-control.module.css'

export default {
    SegmentedControl: SegmentedControl.extend({
        classNames: {
            root: classes.root,
            indicator: classes.indicator,
            label: classes.label
        },
        defaultProps: {
            radius: 'md',
            transitionDuration: 200
        }
    })
}
