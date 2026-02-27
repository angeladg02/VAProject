import * as d3 from 'd3';

export function drawBoxPlot(data, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    const width = container.node().clientWidth || 200;
    const height = container.node().clientHeight || 200;
    const margin = { top: 20, right: 20, bottom: 20, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (data.length === 0) return;

    const values = data.map(d => +d.LapTime_Sec).sort(d3.ascending);
    const q1 = d3.quantile(values, .25);
    const median = d3.quantile(values, .5);
    const q3 = d3.quantile(values, .75);
    const iqr = q3 - q1;
    const min = Math.max(d3.min(values), q1 - 1.5 * iqr);
    const max = Math.min(d3.max(values), q3 + 1.5 * iqr);

    const y = d3.scaleLinear().domain([d3.min(values) - 0.5, d3.max(values) + 0.5]).range([innerHeight, 0]);
    svg.append("g").call(d3.axisLeft(y).ticks(5));

    const xCenter = innerWidth / 2;
    const boxWidth = Math.min(60, innerWidth * 0.5); // Box non troppo largo

    svg.append("line").attr("x1", xCenter).attr("x2", xCenter).attr("y1", y(min)).attr("y2", y(max)).attr("stroke", "black");

    svg.append("rect")
        .attr("x", xCenter - boxWidth/2).attr("y", y(q3))
        .attr("height", y(q1) - y(q3)).attr("width", boxWidth)
        .attr("stroke", "black").style("fill", "#e94560").style("opacity", 0.6);

    [min, median, max].forEach(val => {
        svg.append("line")
            .attr("x1", xCenter - boxWidth/2).attr("x2", xCenter + boxWidth/2)
            .attr("y1", y(val)).attr("y2", y(val))
            .attr("stroke", "black").attr("stroke-width", val === median ? 2 : 1);
    });
}