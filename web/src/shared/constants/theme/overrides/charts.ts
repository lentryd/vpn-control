// Adapted from remnawave/frontend (AGPL-3.0)
import { BarChart } from '@mantine/charts'

export default {
    BarChart: BarChart.extend({
        defaultProps: {
            barProps: {
                radius: 8
            }
        }
    })
}
