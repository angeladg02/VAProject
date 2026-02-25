import * as d3 from 'd3';

let lines;

export function drawParallelCoordinates(data, containerSelector, onBrushSelection) {
    d3.select(containerSelector).selectAll("*").remove();

   const width = 600; 
    const height = 400; // Leggermente più basso per compattezza
    const margin = { top: 30, right: 30, bottom: 40, left: 40 };

    // DIMENSIONI AGGIORNATE con i nomi del CSV
    const dimensions = ["S1_Delta", "S2_Delta", "S3_Delta", "LapTime_Sec"];

    const svg = d3.select(containerSelector)
        .append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Crea le scale per ogni dimensione
    const y = {};
    for (let dim of dimensions) {
        y[dim] = d3.scaleLinear()
            .domain(d3.extent(data, d => d[dim]))
            .range([height - margin.top - margin.bottom, 0])
            .nice();
    }

    const x = d3.scalePoint()
        .range([0, width - margin.left - margin.right])
        .padding(1)
        .domain(dimensions);

    // Generatore di linee
    const path = d => d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));

    // Disegna le linee (Laps)
    lines = svg.selectAll("path.lap-line")
        .data(data).enter().append("path")
        .attr("class", "lap-line")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", "#1f77b4")
        .style("opacity", 0.4)
        .style("stroke-width", "1.5px");

    // Aggiungi gli assi
    svg.selectAll("myAxis")
        .data(dimensions).enter()
        .append("g")
        .attr("transform", d => `translate(${x(d)})`)
        .each(function(d) { d3.select(this).call(d3.axisLeft().scale(y[d])); })
        .append("text")
        .style("text-anchor", "middle")
        .attr("y", -10)
        .text(d => d)
        .style("fill", "black")
        .style("font-weight", "bold");

    // Implementiamo il Brush coordinato (Trigger)
    const brush = d3.brush()
        .extent([[0, 0], [width - margin.left - margin.right, height - margin.top - margin.bottom]])
        .on("brush end", (event) => {
            if (!event.selection) {
                if (onBrushSelection) onBrushSelection([]); 
                return;
            }
            const [[x0, y0], [x1, y1]] = event.selection;
            
            // Filtra i dati: un giro è selezionato se almeno uno dei suoi punti nei settori cade nel rettangolo
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

// Funzione di Highlight chiamata dagli altri grafici
export function highlightParallel(selectedData) {
    if (!lines) return;
    const selectedSet = new Set(selectedData);
    lines.transition().duration(200)
         .style("stroke", d => selectedSet.has(d) ? "#e31a1c" : "#ccc") // Rosso per i selezionati
         .style("opacity", d => selectedSet.has(d) ? 0.8 : 0.03)
         .style("stroke-width", d => selectedSet.has(d) ? "2.5px" : "1px");
}