import * as d3 from 'd3';
const TEAM_COLORS = {
    "Ferrari": "#e8002d",
    "McLaren": "#ff8000",
    "Mercedes": "#27f4d2",
    "Red Bull Racing": "#3671c6",
    "Aston Martin": "#229971",
    "Alpine": "#0093cc",
    "Williams": "#64c4ff",
    "RB": "#6692ff",
    "Kick Sauber": "#52e252",
    "Haas F1 Team": "#ffffff"
};

export function drawRankingsChart(data, containerId, callbacks, selectedStints = []) {
    const container = d3.select(containerId);
    container.selectAll("*").remove();

    const node = container.node();
    const margin = { top: 20, right: 40, bottom: 30, left: 40 };
    const width = node.clientWidth - margin.left - margin.right;
    const height = node.clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scale
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d.LapNumber))
        .range([0, width]);

    // L'asse Y è invertito: la posizione 1 è in alto
    const yScale = d3.scaleLinear()
        .domain([1, d3.max(data, d => +d.Position)])
        .range([0, height]);

    // Assi
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(10))
        .attr("color", "#888");

    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(10))
        .attr("color", "#888");

    // Line generator
    const line = d3.line()
        .x(d => xScale(+d.LapNumber))
        .y(d => yScale(+d.Position))
        .curve(d3.curveMonotoneX);

    // Raggruppiamo i dati per pilota
    const dataByDriver = d3.group(data, d => d.Driver);

    dataByDriver.forEach((laps, driver) => {
       
         const teamColor = TEAM_COLORS[laps[0].Team] || "#888894";
        
        // Verifica se il pilota è tra quelli selezionati (per evidenziarlo)
        const isSelected = selectedStints.some(s => s.Driver === driver);

        svg.append("path")
            .datum(laps)
            .attr("fill", "none")
            .attr("stroke", teamColor)
            .attr("stroke-width", isSelected ? 4 : 1.5)
            .attr("opacity", selectedStints.length > 0 && !isSelected ? 0.2 : 0.8)
            .attr("d", line)
            .style("cursor", "pointer")
            .on("mouseover", function(event) {
                if (!isSelected) d3.select(this).attr("stroke-width", 3).attr("opacity", 1);
                d3.select("#tooltip").classed("hidden", false)
                    .html(`<strong>Driver: ${driver}</strong>`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                if (!isSelected) d3.select(this).attr("stroke-width", 1.5).attr("opacity", selectedStints.length > 0 ? 0.2 : 0.8);
                d3.select("#tooltip").classed("hidden", true);
            });
    });
}