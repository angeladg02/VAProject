import * as d3 from 'd3';

export function drawBoxPlot(data, containerSelector) {
    d3.select(containerSelector).selectAll("*").remove();

    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    const width = 300 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg").attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (data.length === 0) return;

    // 1. Preparazione dati: estraiamo i tempi e li ordiniamo
    const values = data.map(d => +d.LapTime_Sec).sort(d3.ascending);
    
    // 2. Calcolo statistiche
    const q1 = d3.quantile(values, .25);
    const median = d3.quantile(values, .5);
    const q3 = d3.quantile(values, .75);
    const iqr = q3 - q1;
    const min = Math.max(d3.min(values), q1 - 1.5 * iqr);
    const max = Math.min(d3.max(values), q3 + 1.5 * iqr);

    // 3. Scala Y (Tempo sul giro)
    const y = d3.scaleLinear()
        .domain([d3.min(values) - 0.5, d3.max(values) + 0.5])
        .range([height, 0]);

    // Asse Y
    svg.append("g").call(d3.axisLeft(y));

    const xCenter = width / 2;
    const boxWidth = 100;

    // 4. Disegno Linea Verticale (Baffi)
    svg.append("line")
        .attr("x1", xCenter).attr("x2", xCenter)
        .attr("y1", y(min)).attr("y2", y(max))
        .attr("stroke", "black");

    // 5. Il Box (Q1 - Q3)
    svg.append("rect")
        .attr("x", xCenter - boxWidth/2)
        .attr("y", y(q3))
        .attr("height", y(q1) - y(q3))
        .attr("width", boxWidth)
        .attr("stroke", "black")
        .style("fill", "#e94560")
        .style("opacity", 0.6);

    // 6. Mediana, Min, Max (Linee orizzontali)
    [min, median, max].forEach(val => {
        svg.append("line")
            .attr("x1", xCenter - boxWidth/2)
            .attr("x2", xCenter + boxWidth/2)
            .attr("y1", y(val)).attr("y2", y(val))
            .attr("stroke", "black")
            .attr("stroke-width", val === median ? 3 : 1);
    });

    // Titolo
    svg.append("text")
        .attr("x", width / 2).attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px").style("font-weight", "bold")
        .text("Distribuzione Performance");
}