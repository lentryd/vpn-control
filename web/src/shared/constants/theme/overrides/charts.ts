// Adapted from remnawave/frontend (AGPL-3.0)
import type { BarChartProps } from '@mantine/charts'

// A plain object instead of BarChart.extend(): importing the component here
// would pull recharts into the main bundle instead of the dashboard's chunk.
export default {
    BarChart: {
        defaultProps: {
            barProps: {
                radius: 8
            }
        } satisfies Partial<BarChartProps>
    }
}
