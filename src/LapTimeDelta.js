import * as d3 from 'd3';

let lapPoints;

export function drawLapTimeDelta(data, containerSelector, onBrushSelection) {
    d3.select(containerSelector).selectAll("*").remove();

    const width = 850, height = 500;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.LapNumber)).range([0, innerWidth]);
    const y = d3.scaleLinear().domain(d3.extent(data, d => d.LapTime_Sec)).range([innerHeight, 0]);

    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y));

    lapPoints = svg.selectAll("circle")
        .data(data).enter().append("circle")
        .attr("cx", d => x(d.LapNumber))
        .attr("cy", d => y(d.LapTime_Sec))
        .attr("r", 4)
        .style("fill", "#2ca02c").style("opacity", 0.6);

    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("brush end", (event) => {
            if (!event.selection) { if(onBrushSelection) onBrushSelection([]); return; }
            const [[x0, y0], [x1, y1]] = event.selection;
            const selected = data.filter(d => {
                const cx = x(d.LapNumber), cy = y(d.LapTime_Sec);
                return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            });
            if (onBrushSelection) onBrushSelection(selected);
        });

    svg.append("g").call(brush);
}

export function highlightLapTime(selectedData) {
    if (!lapPoints) return;
    const selectedSet = new Set(selectedData);
    lapPoints.style("fill", d => selectedSet.has(d) ? "#ff7f0e" : "#2ca02c")
             .style("opacity", d => selectedSet.has(d) ? 1 : 0.05)
             .attr("r", d => selectedSet.has(d) ? 5 : 2);
}