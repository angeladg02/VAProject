import * as d3 from 'd3';

let rects;

export function drawStrategyBarChart(data, containerSelector, onSelection) {
    d3.select(containerSelector).selectAll("*").remove();

   // Larghezza dimezzata rispetto a prima
    const width = 600; 
    const height = 400; 
    const margin = { top: 20, right: 20, bottom: 40, left: 80 }; // Margine sinistro ridotto un po'

    const svg = d3.select(containerSelector)
        .append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const drivers = Array.from(new Set(data.map(d => d.Driver))).sort();
    const laps = d3.range(d3.min(data, d => d.LapNumber), d3.max(data, d => d.LapNumber) + 1);

    // Riduciamo il padding per non avere troppo spazio bianco tra i giri
    const x = d3.scaleBand().domain(laps).range([0, width]).padding(0.02); 
    const y = d3.scaleBand().domain(drivers).range([0, height]).padding(0.1);

    const color = d3.scaleOrdinal()
        .domain(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"])
        .range(["#ff3333", "#ffff00", "#ffffff", "#33cc33", "#0066ff"]);

    // Assi
    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickValues(x.domain().filter((d,i) => !(i%5))));
    svg.append("g").call(d3.axisLeft(y));

    // Disegno dei rettangoli (ogni rettangolo è un giro di un pilota)
    rects = svg.selectAll("rect")
        .data(data).enter().append("rect")
        .attr("x", d => x(d.LapNumber))
        .attr("y", d => y(d.Driver))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", d => color(d.Compound.toUpperCase()))
        .attr("stroke", "#ccc")
        .attr("stroke-width", 0.5)
        .style("opacity", 0.8)
        .on("click", (event, d) => {
            onSelection([d]); // Selezione singola al click
        });

    // Aggiungi un brush orizzontale per selezionare range di giri
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("brush end", (event) => {
            if (!event.selection) { onSelection([]); return; }
            const [x0, x1] = event.selection;
            const selected = data.filter(d => {
                const cx = x(d.LapNumber) + x.bandwidth()/2;
                return cx >= x0 && cx <= x1;
            });
            onSelection(selected);
        });

    svg.append("g").call(brush);
}

export function highlightStrategy(selectedData) {
    if (!rects) return;
    const selectedSet = new Set(selectedData);
    rects.transition().duration(200)
         .style("opacity", d => selectedSet.has(d) ? 1 : 0.1)
         .attr("stroke", d => selectedSet.has(d) ? "#000" : "#ccc")
         .attr("stroke-width", d => selectedSet.has(d) ? 1.5 : 0.5);
}