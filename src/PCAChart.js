import * as d3 from 'd3';

export function drawPCAChart(pcaData, containerId, callbacks, selectedStints = []) {
    const container = d3.select(containerId);
    container.selectAll("*").remove(); 
    container.style("position", "relative"); 

    if (!pcaData || !pcaData.stints) return;

    // 1. LETTURA DATI
    const data = pcaData.stints.map(d => ({
        ...d,
        PC1: +d.PC1,
        PC2: +d.PC2
    }));

    // Recupero varianza (es. [65.4, 20.1])
    const variance = pcaData.variance || [0, 0];

    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    if (width === 0 || height === 0) return;

    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block")
        .on("dblclick", (event) => {
            event.preventDefault();
            if (callbacks && callbacks.onReset) callbacks.onReset();
        });

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. SCALE (Range fisso per i punti, senza rScale)
    const xExt = d3.extent(data, d => d.PC1);
    const yExt = d3.extent(data, d => d.PC2);
    const padX = (xExt[1] - xExt[0]) * 0.15 || 1;
    const padY = (yExt[1] - yExt[0]) * 0.15 || 1;

    const xScale = d3.scaleLinear().domain([xExt[0] - padX, xExt[1] + padX]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([yExt[0] - padY, yExt[1] + padY]).range([innerHeight, 0]); 

    // 3. ASSI CON VARIANZA SPIEGATA
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(6))
        .attr("color", "#888894")
        .append("text")
        .attr("x", innerWidth)
        .attr("y", 35)
        .attr("fill", "#f5f5f5")
        .attr("text-anchor", "end")
        .style("font-weight", "bold")
        .text(`PC1 (${variance[0].toFixed(1)}%)`); // Aggiunta varianza

    g.append("g")
        .call(d3.axisLeft(yScale).ticks(6))
        .attr("color", "#888894")
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -35)
        .attr("fill", "#f5f5f5")
        .attr("text-anchor", "end")
        .style("font-weight", "bold")
        .text(`PC2 (${variance[1].toFixed(1)}%)`); // Aggiunta varianza

    // 4. BRUSH
    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("end", brushed);
    
    g.append("g").attr("class", "brush").call(brush);

    // 5. PUNTI (Minimalisti: colore neutro e raggio fisso)
    const tooltip = d3.select("#tooltip");

    const points = g.append("g").attr("class", "points").selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.PC1))
        .attr("cy", d => yScale(d.PC2))
        .attr("r", 5) // Raggio fisso
        .attr("fill", "#cccccc") // Colore neutro unico
        .attr("stroke", d => selectedStints.some(s => s.StintID === d.StintID) ? "#00ff00" : "#15151e")
        .attr("stroke-width", d => selectedStints.some(s => s.StintID === d.StintID) ? 2 : 0.5)
        .style("opacity", d => (selectedStints.length === 0) ? 0.6 : (selectedStints.some(s => s.StintID === d.StintID) ? 1 : 0.2))
        .style("cursor", "pointer")
        .on("click", (event, d) => callbacks?.onStintClick?.([d]))
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 7).attr("stroke", "#ffffff").attr("stroke-width", 2).raise();
            
            tooltip.classed("hidden", false)
                .html(`
                    <strong>${d.Driver}</strong> - ${d.Compound}<br/>
                    Giri: ${d.TotalLaps}<br/>
                    PC1: ${d.PC1.toFixed(2)} | PC2: ${d.PC2.toFixed(2)}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function(event, d) {
            tooltip.classed("hidden", true);
            const isSelected = selectedStints.some(s => s.StintID === d.StintID);
            d3.select(this)
                .attr("r", 5)
                .attr("stroke", isSelected ? "#00ff00" : "#15151e")
                .attr("stroke-width", isSelected ? 2 : 0.5);
        });

    function brushed(event) {
        const selection = event.selection;
        if (!selection) {
            if (callbacks && callbacks.onStintClick) callbacks.onStintClick([]);
            return;
        }
        const [[x0, y0], [x1, y1]] = selection;
        const geometricallySelected = data.filter(d => {
            const cx = xScale(d.PC1);
            const cy = yScale(d.PC2);
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        });
        if (callbacks && callbacks.onStintClick) callbacks.onStintClick(geometricallySelected);
    }
}