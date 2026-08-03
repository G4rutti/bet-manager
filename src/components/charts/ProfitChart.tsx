"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
);

interface ProfitChartProps {
  data: { date: string; profit: number; cumulativeProfit: number }[];
}

export function ProfitChart({ data }: ProfitChartProps) {
  const chartData = {
    labels: data.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
    }),
    datasets: [
      {
        label: "Lucro Acumulado",
        data: data.map((d) => d.cumulativeProfit),
        borderColor: "#2f9e8f",
        backgroundColor: "rgba(47, 158, 143, 0.12)",
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#2f9e8f",
        pointHoverBorderColor: "#e9eaec",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1d1f22",
        borderColor: "#2a2c30",
        borderWidth: 1,
        titleColor: "#e9eaec",
        bodyColor: "#e9eaec",
        padding: 12,
        titleFont: { size: 12 },
        bodyFont: { size: 14, weight: "bold" as const },
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y ?? 0;
            return `R$ ${val.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: {
          color: "#8b8d93",
          font: { size: 10 },
          maxTicksLimit: 6,
        },
        border: { display: false },
      },
      y: {
        display: true,
        grid: {
          color: "rgba(233, 234, 236, 0.08)",
        },
        ticks: {
          color: "#8b8d93",
          font: { size: 10 },
          callback: (value: string | number) => `R$ ${value}`,
        },
        border: { display: false },
      },
    },
  };

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Sem dados para exibir
      </div>
    );
  }

  return <Line data={chartData} options={options} />;
}
