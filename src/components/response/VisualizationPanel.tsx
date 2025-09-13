import React, { useMemo, useState } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
} from 'chart.js';
import { EmptyState } from '../ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { ChartBar } from '../icons';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement
);

interface VisualizationPanelProps {
  data: any;
}

const findSuitableData = (data: any): { path: string, array: any[] } | null => {
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return { path: 'root', array: data };
    }
    if (typeof data === 'object' && data !== null) {
        for (const key in data) {
            const value = data[key];
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                return { path: key, array: value };
            }
        }
    }
    return null;
}

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ data }) => {
    const suitableData = useMemo(() => findSuitableData(data), [data]);

    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
    const [labelKey, setLabelKey] = useState<string>('');
    const [dataKey, setDataKey] = useState<string>('');

    const keys = useMemo(() => {
        if (!suitableData) return { stringKeys: [], numberKeys: [] };
        const firstItem = suitableData.array[0];
        const stringKeys: string[] = [];
        const numberKeys: string[] = [];
        Object.keys(firstItem).forEach(key => {
            if (typeof firstItem[key] === 'string') stringKeys.push(key);
            if (typeof firstItem[key] === 'number') numberKeys.push(key);
        });
        
        if (!labelKey) setLabelKey(stringKeys[0] || '');
        if (!dataKey) setDataKey(numberKeys[0] || '');

        return { stringKeys, numberKeys };
    }, [suitableData, labelKey, dataKey]);

    const chartData = useMemo(() => {
        if (!suitableData || !labelKey || !dataKey) return null;
        
        const labels = suitableData.array.map(item => item[labelKey]);
        const values = suitableData.array.map(item => item[dataKey]);

        return {
            labels,
            datasets: [{
                label: `${dataKey} by ${labelKey}`,
                data: values,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
            }]
        };
    }, [suitableData, labelKey, dataKey]);

    if (!suitableData) {
        return <EmptyState icon={<ChartBar className="h-12 w-12 stroke-1 text-muted-foreground" />} message="No visualizable data found. Visualization works best with an array of objects." />;
    }

    return (
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2 border border-border rounded-lg bg-muted">
                <div>
                    <label className="text-xs font-semibold text-muted-foreground">Chart Type</label>
                    <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="bar">Bar Chart</SelectItem>
                            <SelectItem value="line">Line Chart</SelectItem>
                            <SelectItem value="pie">Pie Chart</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <label className="text-xs font-semibold text-muted-foreground">Label (X-Axis)</label>
                    <Select value={labelKey} onValueChange={setLabelKey}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {keys.stringKeys.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <label className="text-xs font-semibold text-muted-foreground">Data (Y-Axis)</label>
                    <Select value={dataKey} onValueChange={setDataKey}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {keys.numberKeys.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="h-96">
                {chartData && chartType === 'bar' && <Bar data={chartData} options={{ maintainAspectRatio: false }} />}
                {chartData && chartType === 'line' && <Line data={chartData} options={{ maintainAspectRatio: false }} />}
                {chartData && chartType === 'pie' && <Pie data={chartData} options={{ maintainAspectRatio: false }} />}
            </div>
        </div>
    );
};