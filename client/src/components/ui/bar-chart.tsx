import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface BarChartProps {
  data: Array<{
    date: string;
    request_count: number;
    agent_name: string;
  }>;
  xField: string;
  yField: string;
  categoryField: string;
}

export function BarChart({ data, xField, yField, categoryField }: BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Setup dimensions
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = svgRef.current.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const categories = Array.from(new Set(data.map(d => String(d[categoryField as keyof typeof d]))));
    const x = d3.scaleBand<string>()
      .domain(data.map(d => String(d[xField as keyof typeof d])))
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => Number(d[yField as keyof typeof d])) || 0])
      .range([height, 0]);

    const color = d3.scaleOrdinal<string>()
      .domain(categories)
      .range(d3.schemeCategory10);

    // Add X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    // Add Y axis
    svg.append("g")
      .call(d3.axisLeft(y));

    // Add bars
    svg.selectAll(".bar")
      .data(data)
      .join("rect")
      .attr("class", "bar")
      .attr("x", d => x(String(d[xField as keyof typeof d])) || 0)
      .attr("y", d => y(Number(d[yField as keyof typeof d])))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(Number(d[yField as keyof typeof d])))
      .attr("fill", d => color(String(d[categoryField as keyof typeof d])));

    // Add legend
    const legend = svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "start")
      .selectAll("g")
      .data(categories)
      .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 20 - 10})`);

    legend.append("rect")
      .attr("x", width - 19)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", color);

    legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text(d => d);

  }, [data, xField, yField, categoryField]);

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
