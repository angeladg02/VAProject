import * as d3 from 'd3';

let lines;
let colorScale = d3.scaleOrdinal()
    .domain(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"])
    .range(["#ff3333", "#ffff00", "#ffffff", "#33cc33", "#0066ff"]);

export function drawParallelCoordinates(data, containerSelector, onBrushSelection) {
    d3.select(containerSelector).selectAll("*").remove();

    // 1. Setup Dimensioni (Molto largo per evitare spaghetti)
    const width = 1100; 
    const height = 450;
    const margin = { top: 60, right: 50, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const dimensions = ["S1_Delta", "S2_Delta", "S3_Delta", "SpeedST", "TyreLife", "LapTime_Sec"];

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Scale
    const y = {};
    dimensions.forEach(dim => {
        y[dim] = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[dim]))
            .range([innerHeight, 0])
            .nice();
    });

    const x = d3.scalePoint()
        .range([0, innerWidth])
        .padding(0.4)
        .domain(dimensions);

    const lineGenerator = d3.line()
        .curve(d3.curveMonotoneX) 
        .x(d => d[0])
        .y(d => d[1]);

    const path = d => lineGenerator(dimensions.map(p => [x(p), y[p](d[p])]));

    // 3. Disegno Linee (Stato Iniziale)
    lines = svg.append("g")
        .attr("class", "lines-group")
        .selectAll("path")
        .data(data).enter().append("path")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", d => colorScale(d.Compound ? d.Compound.toUpperCase() : "MEDIUM"))
        .style("opacity", 0.25)
        .style("stroke-width", "1.2px")
        .style("pointer-events", "none");

    // 4. Assi Eleganti
    const axes = svg.selectAll(".axis")
        .data(dimensions).enter()
        .append("g")
        .attr("transform", d => `translate(${x(d)})`);

    axes.each(function(d) {
        d3.select(this).call(d3.axisLeft(y[d]).ticks(8).tickSize(-5));
    });

    axes.append("text")
        .style("text-anchor", "middle")
        .attr("y", -25)
        .text(d => d.replace("_Delta", ""))
        .style("fill", "#1a1a2e")
        .style("font-size", "14px")
        .style("font-weight", "800");

    // 5. Brush Ottimizzato (Fix per i bug)
    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("brush", (event) => {
            const selection = event.selection;
            if (!selection) return;

            const [[x0, y0], [x1, y1]] = selection;

            // Filtro veloce senza attivare handleSelection ad ogni pixel
            lines.style("opacity", d => {
                const active = dimensions.some(dim => {
                    const cx = x(dim);
                    const cy = y[dim](d[dim]);
                    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
                });
                return active ? 1 : 0.02;
            }).style("stroke-width", d => {
                 const active = dimensions.some(dim => {
                    const cx = x(dim);
                    const cy = y[dim](d[dim]);
                    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
                });
                return active ? "2.5px" : "1px";
            });
        })
        .on("end", (event) => {
            if (!event.selection) {
                lines.style("opacity", 0.25).style("stroke-width", "1.2px");
                if (onBrushSelection) onBrushSelection([]);
                return;
            }
            // Solo alla fine del brush inviamo i dati al resto della dashboard
            const [[x0, y0], [x1, y1]] = event.selection;
            const selected = data.filter(d => {
                return dimensions.some(dim => {
                    const cx = x(dim);
                    const cy = y[dim](d[dim]);
                    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
                });
            });
            if (onBrushSelection) onBrushSelection(selected);
        });

    svg.append("g").attr("class", "brush").call(brush);
}

export function highlightParallel(selectedData) {
    if (!lines) return;
    const isFullSet = selectedData.length === 0;
    const selectedSet = new Set(selectedData);
    
    // Usiamo una transizione fluida solo per l'highlight esterno
    lines.interrupt() 
        .transition().duration(200)
        .style("opacity", d => isFullSet ? 0.25 : (selectedSet.has(d) ? 1 : 0.02))
        .style("stroke-width", d => isFullSet ? "1.2px" : (selectedSet.has(d) ? "2.8px" : "0.8px"))
        .style("stroke", d => {
            if (isFullSet) return colorScale(d.Compound ? d.Compound.toUpperCase() : "MEDIUM");
            return selectedSet.has(d) ? colorScale(d.Compound ? d.Compound.toUpperCase() : "MEDIUM") : "#ddd";
        });
}