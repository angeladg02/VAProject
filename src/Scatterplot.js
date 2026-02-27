import * as d3 from 'd3';

let circles; 
let colorScale;

export function drawScatterPlot(data, containerSelector, onBrushSelection) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    // Lettura dinamica delle dimensioni per la griglia CSS
    const width = container.node().clientWidth || 400;
    const height = container.node().clientHeight || 300;
    const margin = { top: 20, right: 80, bottom: 40, left: 40 }; // right margin per la legenda
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain(d3.extent(data, d => +d.pca_x)).range([0, innerWidth]).nice();
    const yScale = d3.scaleLinear().domain(d3.extent(data, d => +d.pca_y)).range([innerHeight, 0]).nice();

    colorScale = d3.scaleOrdinal()
        .domain(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"])
        .range(["#d7191c", "#fdae61", "#878787", "#1a9641", "#2b83ba"]);

    // Linee dei Quadranti PCA (Aiutano l'analisi)
    svg.append("line").attr("x1", 0).attr("x2", innerWidth).attr("y1", yScale(0)).attr("y2", yScale(0)).attr("stroke", "#ccc").attr("stroke-dasharray", "4");
    svg.append("line").attr("x1", xScale(0)).attr("x2", xScale(0)).attr("y1", 0).attr("y2", innerHeight).attr("stroke", "#ccc").attr("stroke-dasharray", "4");

    // Assi
    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(xScale));
    svg.append("g").call(d3.axisLeft(yScale));

    // 1. CREAZIONE DEL BRUSH (Disegnato PRIMA dei punti, fa da sfondo interattivo)
    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("brush end", (event) => {
            if (!event.selection) {
                if (onBrushSelection && event.type === 'end') onBrushSelection([]); 
                return;
            }
            const [[x0, y0], [x1, y1]] = event.selection;
            const selected = data.filter(d => {
                const cx = xScale(d.pca_x), cy = yScale(d.pca_y);
                return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
            });
            
            if (onBrushSelection && event.type === 'end') onBrushSelection(selected);
        });

    svg.append("g").attr("class", "brush").call(brush);

    // 2. SETUP TOOLTIP
    let tooltip = d3.select("body").select(".pca-tooltip");
    if (tooltip.empty()) { 
        tooltip = d3.select("body").append("div")
            .attr("class", "pca-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(26, 26, 46, 0.95)") // Stesso colore della tua sidebar
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "8px")
            .style("box-shadow", "0px 4px 10px rgba(0,0,0,0.3)")
            .style("pointer-events", "none") // Cruciale: evita che il mouse si incastri nel tooltip
            .style("font-size", "12px")
            .style("font-family", "sans-serif")
            .style("opacity", 0)
            .style("z-index", 1000); 
    }

    // 3. DISEGNO DEI PUNTI (Disegnati SOPRA il brush per catturare il mouseover)
    circles = svg.append("g").selectAll("circle")
        .data(data).enter().append("circle")
        .attr("cx", d => xScale(d.pca_x))
        .attr("cy", d => yScale(d.pca_y))
        .attr("r", 4)
        .style("fill", d => colorScale(d.Compound ? d.Compound.toUpperCase() : "MEDIUM"))
        .style("opacity", 0.6)
        .style("stroke", "#fff")
        .style("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            // Effetto Focus sul punto
            d3.select(this).attr("r", 7).style("stroke", "#000").style("stroke-width", 1.5).style("opacity", 1);
            
            // Apparizione e contenuto del Tooltip
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong style="color:#e94560; font-size:14px; display:block; margin-bottom:4px;">${d.Driver}</strong>
                Giro: <b style="color:#f39c12;">${d.LapNumber}</b><br/>
                Tempo: <b>${d.LapTime_Sec}s</b><br/>
                Mescola: <b>${d.Compound}</b>
            `)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            // Ritorna alla dimensione normale (l'opacità viene ripristinata dall'highlight)
            d3.select(this).attr("r", 4).style("stroke", "#fff").style("stroke-width", 0.5);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // 4. LEGENDA (Disegnata fuori dal grafico)
    const legend = svg.append("g").attr("transform", `translate(${innerWidth + 15}, 10)`);
    const compounds = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"];
    compounds.forEach((compound, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
        row.append("circle").attr("cx", 5).attr("cy", 5).attr("r", 5).style("fill", colorScale(compound)).style("stroke", "#000");
        row.append("text").attr("x", 15).attr("y", 9).style("font-size", "10px").text(compound);
    });
}

// Funzione chiamata da index.js quando si fa una selezione altrove
export function highlightScatter(selectedData) {
    if (!circles) return;
    const isFullSet = selectedData.length === 0;
    const selectedSet = new Set(selectedData);
    
    circles.transition().duration(200)
           .style("opacity", d => isFullSet ? 0.6 : (selectedSet.has(d) ? 1 : 0.05))
           .attr("r", d => isFullSet ? 4 : (selectedSet.has(d) ? 5 : 3))
           .style("stroke-width", d => (!isFullSet && selectedSet.has(d)) ? 1 : 0.5);
}