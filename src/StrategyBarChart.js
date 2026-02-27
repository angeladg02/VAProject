import * as d3 from 'd3';

let rects;

export function drawStrategyBarChart(data, containerSelector, onSelection) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    const width = container.node().clientWidth || 300;
    const height = container.node().clientHeight || 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 60 }; 
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const drivers = Array.from(new Set(data.map(d => d.Driver))).sort();
    const laps = d3.range(d3.min(data, d => d.LapNumber), d3.max(data, d => d.LapNumber) + 1);

    const x = d3.scaleBand().domain(laps).range([0, innerWidth]).padding(0.02); 
    const y = d3.scaleBand().domain(drivers).range([0, innerHeight]).padding(0.1);

    const color = d3.scaleOrdinal()
        .domain(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"])
        .range(["#ff3333", "#ffff00", "#d9d9d9", "#33cc33", "#0066ff"]);

    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).tickValues(x.domain().filter((d,i) => !(i%10))));
    svg.append("g").call(d3.axisLeft(y).tickSize(0));

    rects = svg.selectAll("rect")
        .data(data).enter().append("rect")
        .attr("x", d => x(d.LapNumber)).attr("y", d => y(d.Driver))
        .attr("width", x.bandwidth()).attr("height", y.bandwidth())
        .attr("fill", d => color(d.Compound.toUpperCase()))
        .style("opacity", 0.8)
        .on("click", (event, d) => onSelection([d]));

    const brush = d3.brushX().extent([[0, 0], [innerWidth, innerHeight]])
        .on("brush end", (event) => {
            if (!event.selection) { if(event.type === 'end') onSelection([]); return; }
            const [x0, x1] = event.selection;
            const selected = data.filter(d => {
                const cx = x(d.LapNumber) + x.bandwidth()/2;
                return cx >= x0 && cx <= x1;
            });
            if (event.type === 'end') onSelection(selected);
        });

    svg.append("g").call(brush);
}

export function highlightStrategy(selectedData) {
    if (!rects) return;
    const isFullSet = selectedData.length === 0;
    const selectedSet = new Set(selectedData);
    rects.style("opacity", d => isFullSet ? 0.8 : (selectedSet.has(d) ? 1 : 0.1))
         .attr("stroke", d => isFullSet ? "none" : (selectedSet.has(d) ? "#000" : "none"))
         .attr("stroke-width", d => isFullSet ? 0 : (selectedSet.has(d) ? 1 : 0));
}