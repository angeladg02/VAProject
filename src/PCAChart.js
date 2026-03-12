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

    const margin = { top: 20, right: 20, bottom: 35, left: 40 };
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
    // 3. ASSI CON VARIANZA SPIEGATA
g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(6))
    .attr("color", "#888") // Uniformato
    .append("text")
    .attr("x", innerWidth)
    .attr("y", 35)
    .attr("fill", "#888") // Cambiato da #f5f5f5
    .attr("text-anchor", "end")
    .style("font-weight", "bold")
    .text(`PC1 (${variance[0].toFixed(1)}%)`);

g.append("g")
    .call(d3.axisLeft(yScale).ticks(6))
    .attr("color", "#888")
    .append("text")
    .attr("x", +30)          // leggermente a sinistra dell'asse
    .attr("y", -10)         // sopra l'asse Y
    .attr("fill", "#888")
    .attr("text-anchor", "end")
    .style("font-weight", "bold")
    .text(`PC2 (${variance[1].toFixed(1)}%)`);

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
      // ... (codice precedente dei punti)
.on("mouseover", function(event, d) {
    d3.select(this)
        .attr("r", 8) // Aumenta leggermente il raggio per feedback visivo
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .raise();
    
    // TOOLTIP OTTIMIZZATO
    tooltip.classed("hidden", false)
        .html(`
            <div style="border-left: 4px solid #888; padding-left: 8px;">
                <div style="font-weight: bold; font-size: 1rem; margin-bottom: 4px;">
                    ${d.Driver} 
                </div>
                 <div style="font-size: 0.85rem; color: #aaa; margin-bottom: 5px;">${d.Team}</div>
                <div style="margin-bottom: 2px;">
                    Stint: <strong>#${d.StintNumber || d.StintID}</strong> | 
                    Compound: <span style="color:${d.Compound === 'SOFT' ? '#e10600' : d.Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff'}; font-weight: bold;">${d.Compound}</span>
                </div>
                <hr style="border: 0; border-top: 1px solid #444; margin: 4px 0;">
                <div style="font-size: 0.85rem;">
                    <div>Laps Completed: <strong>${d.TotalLaps}</strong></div>
                    <div>Avg Degradation: <strong>${d.DegradationSlope ? d.DegradationSlope.toFixed(3) : 'N/A'} s/l</strong></div>
                    <div style="margin-top: 4px; color: #00ffcc; font-family: monospace;">
                        PC1: ${d.PC1.toFixed(2)} | PC2: ${d.PC2.toFixed(2)}
                    </div>
                </div>
            </div>
        `)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
})
// ... (codice successivo on("mouseout"))
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