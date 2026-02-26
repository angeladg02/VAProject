import * as d3 from 'd3';

let lapPoints;

export function drawLapTimeDelta(data, containerSelector, onBrushSelection) {
    d3.select(containerSelector).selectAll("*").remove();

    const width = 850, height = 400; // Ridotto leggermente per stare meglio nella griglia
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(data, d => +d.LapNumber)).range([0, innerWidth]);
    const y = d3.scaleLinear().domain(d3.extent(data, d => +d.LapTime_Sec)).range([innerHeight, 0]);

    // Assi
    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y));

    lapPoints = svg.selectAll("circle")
        .data(data).enter().append("circle")
        .attr("cx", d => x(+d.LapNumber))
        .attr("cy", d => y(+d.LapTime_Sec))
        .attr("r", 4)
        .style("fill", "#2ca02c").style("opacity", 0.6);

    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on("brush end", (event) => {
            if (!event.selection) { 
                lapPoints.style("opacity", 0.6).style("fill", "#2ca02c");
                if(onBrushSelection) onBrushSelection([]); 
                return; 
            }
            const [[x0, y0], [x1, y1]] = event.selection;
            const selected = data.filter(d => {
                const cx = x(d.LapNumber), cy = y(d.LapTime_Sec);
                return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            });
            
            // Feedback visivo immediato
            lapPoints.style("opacity", d => {
                const cx = x(d.LapNumber), cy = y(d.LapTime_Sec);
                return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 ? 1 : 0.1;
            });

            if (onBrushSelection) onBrushSelection(selected);
        });

    svg.append("g").attr("class", "brush").call(brush);
}

// 2. FUNZIONE ANALITICA: Calcola la pendenza e l'intercetta
export function calculateRegression(selectedData) {
    if (selectedData.length < 2) return null;

    const n = selectedData.length;
    const sumX = d3.sum(selectedData, d => +d.TyreLife);
    const sumY = d3.sum(selectedData, d => +d.LapTime_Sec);
    const sumXY = d3.sum(selectedData, d => (+d.TyreLife) * (+d.LapTime_Sec));
    const sumX2 = d3.sum(selectedData, d => (+d.TyreLife) * (+d.TyreLife));

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

// 3. FUNZIONE VISUALE: Disegna la retta sul grafico
export function drawDegradationLine(containerSelector, selectedData, data) {
    const svg = d3.select(containerSelector).select("g");
    svg.selectAll(".regression-line").remove(); // Pulisce la linea precedente

    const regression = calculateRegression(selectedData);
    if (!regression) return null;

    // Riutilizziamo le scale (dobbiamo ricalcolarle o passarle, qui le ricalcoliamo per semplicità)
    const width = 850 - 50 - 30;
    const height = 400 - 30 - 40;
    const x = d3.scaleLinear().domain(d3.extent(data, d => +d.LapNumber)).range([0, width]);
    const y = d3.scaleLinear().domain(d3.extent(data, d => +d.LapTime_Sec)).range([height, 0]);

    // Usiamo TyreLife come riferimento per la regressione, 
    // ma la disegniamo rispetto ai numeri di giro selezionati
    const minLap = d3.min(selectedData, d => +d.LapNumber);
    const maxLap = d3.max(selectedData, d => +d.LapNumber);

    const lineData = [
        { lap: minLap, time: regression.slope * d3.min(selectedData, d => +d.TyreLife) + regression.intercept },
        { lap: maxLap, time: regression.slope * d3.max(selectedData, d => +d.TyreLife) + regression.intercept }
    ];

    const lineGenerator = d3.line()
        .x(d => x(d.lap))
        .y(d => y(d.time));

    svg.append("path")
        .datum(lineData)
        .attr("class", "regression-line")
        .attr("d", lineGenerator)
        .attr("stroke", "#e94560") // Rosso sidebar per coerenza
        .attr("stroke-width", 3)
        .attr("fill", "none")
        .attr("stroke-dasharray", "5,5");

    return regression.slope * 1000; // Ritorna il valore ms/giro per la sidebar
}

export function highlightLapTime(selectedData) {
    if (!lapPoints) return;
    const selectedSet = new Set(selectedData);
    lapPoints.style("fill", d => selectedSet.has(d) ? "#e94560" : "#2ca02c")
             .style("opacity", d => selectedSet.has(d) ? 1 : 0.05)
             .attr("r", d => selectedSet.has(d) ? 5 : 2);
}