import * as d3 from 'd3';

export function drawSectorBarChart(data, containerSelector) {
    // 1. Pulizia e Setup
    d3.select(containerSelector).selectAll("*").remove();

    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const width = 400 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Calcolo Medie Analitiche (Il "Trigger") 

const avgS1 = d3.mean(data, d => +d.S1_Delta) || 0;
const avgS2 = d3.mean(data, d => +d.S2_Delta) || 0;
const avgS3 = d3.mean(data, d => +d.S3_Delta) || 0;

const sectorData = [
    { sector: "Settore 1", value: avgS1 },
    { sector: "Settore 2", value: avgS2 },
    { sector: "Settore 3", value: avgS3 }
];

    // 3. Scale
    const x = d3.scaleBand()
        .domain(sectorData.map(d => d.sector))
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(sectorData, d => d.value) * 1.1])
        .range([height, 0]);

    // 4. Assi
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g").call(d3.axisLeft(y));

    // 5. Disegno Barre
    svg.selectAll(".bar")
        .data(sectorData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.sector))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", "#0056b3");

    // Titolo
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Tempi Medi Settori (Selezione)");
}