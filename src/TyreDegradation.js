import * as d3 from 'd3';

let tyrePoints;

export function drawTyreDegradation(data, containerSelector, onBrushSelection) {
    d3.select(containerSelector).selectAll("*").remove();

    const width = 850, height = 500;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.TyreLife)).range([0, innerWidth]);
    const y = d3.scaleLinear().domain(d3.extent(data, d => d.LapTime_Sec)).range([innerHeight, 0]);
    
    const color = d3.scaleOrdinal()
        .domain(["SOFT", "MEDIUM", "HARD"])
        .range(["#ff3333", "#ffff00", "#ffffff"]);

    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x)).append("text").attr("x", innerWidth/2).attr("y", 35).attr("fill", "black").text("Tyre Life (Laps)");
    svg.append("g").call(d3.axisLeft(y));

    // Sfondo scuro per far risaltare le gomme HARD bianche
    svg.insert("rect", ":first-child")
        .attr("width", innerWidth).attr("height", innerHeight)
        .attr("fill", "#2c3e50"); 

    tyrePoints = svg.selectAll("circle")
        .data(data).enter().append("circle")
        .attr("cx", d => x(d.TyreLife))
        .attr("cy", d => y(d.LapTime_Sec))
        .attr("r", 4)
        .style("fill", d => color(d.Compound ? d.Compound.toUpperCase() : "MEDIUM"))
        .style("stroke", "#000").style("opacity", 0.8);

    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("brush end", (event) => {
            if (!event.selection) { if(onBrushSelection) onBrushSelection([]); return; }
            const [[x0, y0], [x1, y1]] = event.selection;
            const selected = data.filter(d => {
                const cx = x(d.TyreLife), cy = y(d.LapTime_Sec);
                return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            });
            if (onBrushSelection) onBrushSelection(selected);
        });

    svg.append("g").call(brush);
}

export function highlightTyre(selectedData) {
    if (!tyrePoints) return;
    const selectedSet = new Set(selectedData);
    tyrePoints.style("opacity", d => selectedSet.has(d) ? 1 : 0.05)
              .style("stroke-width", d => selectedSet.has(d) ? 1 : 0);
}