import * as d3 from 'd3';

let circles; // Variabile globale al modulo per poter fare l'highlight dall'esterno

export function drawScatterPlot(data, containerSelector, onBrushSelection) {
    d3.select(containerSelector).selectAll("*").remove();

    const width = 850, height = 500;
    const margin = { top: 40, right: 120, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain(d3.extent(data, d => d.pca_x)).range([0, innerWidth]).nice();
    const yScale = d3.scaleLinear().domain(d3.extent(data, d => d.pca_y)).range([innerHeight, 0]).nice();

    const compounds = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"];
    const compoundColors = ["#ff3333", "#ffff00", "#ffffff", "#33cc33", "#0066ff"];
    const colorScale = d3.scaleOrdinal().domain(compounds).range(compoundColors);

    // Assi
    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(xScale));
    svg.append("g").call(d3.axisLeft(yScale));

    // Tooltip
    let tooltip = d3.select("body").select(".d3-tooltip");
    if (tooltip.empty()) { tooltip = d3.select("body").append("div").attr("class", "d3-tooltip"); }

    // Disegno dei Punti
    circles = svg.selectAll("circle")
        .data(data).enter().append("circle")
        .attr("cx", d => xScale(d.pca_x))
        .attr("cy", d => yScale(d.pca_y))
        .attr("r", 5)
        .attr("fill", d => colorScale(d.Compound ? d.Compound.toUpperCase() : "MEDIUM"))
        .attr("opacity", 0.7)
        .attr("stroke", "black").attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke-width", 2).attr("opacity", 1).attr("r", 8);
            tooltip.transition().duration(200).style("opacity", 0.95);
            tooltip.html(`<b>Pilota:</b> ${d.Driver} <br/><b>Giro:</b> ${d.LapNumber} <br/><b>Tempo:</b> ${d.LapTime_Sec}s`)
                .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            d3.select(this).attr("stroke-width", 0.5).attr("opacity", 0.7).attr("r", 5);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Legenda
    const legend = svg.append("g").attr("transform", `translate(${innerWidth + 20}, 20)`);
    compounds.forEach((compound, i) => {
        const legendRow = legend.append("g").attr("transform", `translate(0, ${i * 25})`);
        legendRow.append("circle").attr("cx", 6).attr("cy", 5).attr("r", 6).attr("fill", colorScale(compound)).attr("stroke", "black");
        legendRow.append("text").attr("x", 20).attr("y", 9).style("font-size", "12px").text(compound);
    });

    // Brush
    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("brush end", (event) => {
            if (!event.selection) {
                circles.attr("opacity", 0.7);
                if (onBrushSelection) onBrushSelection([]); 
                return;
            }
            const [[x0, y0], [x1, y1]] = event.selection;
            const selectedData = data.filter(d => {
                const cx = xScale(d.pca_x), cy = yScale(d.pca_y);
                return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
            });

            circles.attr("opacity", d => {
                const cx = xScale(d.pca_x), cy = yScale(d.pca_y);
                return (x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1) ? 1 : 0.05;
            });

            if (onBrushSelection) onBrushSelection(selectedData);
        });

    svg.append("g").attr("class", "brush").call(brush);
}

// Funzione richiamata da index.js quando si usa un altro grafico
export function highlightScatter(selectedData) {
    if (!circles) return;
    const selectedSet = new Set(selectedData);
    circles.attr("opacity", d => selectedSet.has(d) ? 1 : 0.05)
           .attr("stroke-width", d => selectedSet.has(d) ? 1 : 0);
}