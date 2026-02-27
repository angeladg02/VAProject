import * as d3 from 'd3';

let lines;
let colorScale;
let allData;
let x, y, dimensions;

export function drawParallelCoordinates(data, containerSelector, onBrushSelection) {
    allData = data;
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    const width = container.node().clientWidth || 800;
    const height = container.node().clientHeight || 300;
    const margin = { top: 40, right: 30, bottom: 20, left: 30 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    dimensions = ["S1_Delta", "S2_Delta", "S3_Delta", "SpeedST"];

    const svg = container.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    y = {};
    dimensions.forEach(dim => {
        y[dim] = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[dim]))
            .range([innerHeight, 0]).nice();
    });

    x = d3.scalePoint().range([0, innerWidth]).padding(0.1).domain(dimensions);

    // Torniamo alla palette delle gomme! L'unica cosa che conta per la strategia
    colorScale = d3.scaleOrdinal()
        .domain(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"])
        .range(["#d7191c", "#fdae61", "#878787", "#1a9641", "#2b83ba"]);

    const path = d => d3.line().x(p => x(p)).y(p => y[p](d[p]))(dimensions);

    // Disegniamo tutte le linee, ma sbiadite (Overview generica)
    lines = svg.append("g").attr("class", "lines-group").selectAll("path")
        .data(data).enter().append("path")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", d => colorScale(d.Compound ? d.Compound.toUpperCase() : "MEDIUM"))
        .style("opacity", 0.15) // Contesto visivo pulito
        .style("stroke-width", "1px");

    const axes = svg.selectAll(".axis").data(dimensions).enter()
        .append("g").attr("transform", d => `translate(${x(d)})`);

    axes.each(function(d) { d3.select(this).call(d3.axisLeft(y[d]).ticks(6)); });
    
    axes.append("text")
        .style("text-anchor", "middle").attr("y", -15)
        .text(d => d.replace("_Delta", ""))
        .style("fill", "black").style("font-size", "12px").style("font-weight", "bold");
        
    // Tooltip per risalire al pilota (Detail on demand!)
    lines.append("title").text(d => `${d.Driver} - Lap ${d.LapNumber} (${d.Compound})`);
}

export function highlightParallel(selectedData) {
    if (!lines) return;
    const isFullSet = selectedData.length === 0;
    const selectedSet = new Set(selectedData);

    lines.transition().duration(200)
         .style("opacity", d => {
             if (isFullSet) return 0.15; // Nessuna selezione: mostra il macro-trend
             return selectedSet.has(d) ? 0.9 : 0.02; // Selezione: evidenzia solo i giri scelti, nascondi il resto
         })
         .style("stroke-width", d => (!isFullSet && selectedSet.has(d)) ? "2.5px" : "1px");
}