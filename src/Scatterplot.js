import * as d3 from 'd3';

export function drawScatterPlot(data, containerSelector) {
    // 1. Pulisce il contenitore (utile se si ricaricano i dati interattivamente)
    d3.select(containerSelector).selectAll("*").remove();

    // 2. Impostazioni dimensioni e margini
    // Ho aumentato il margine destro (a 120) per fare spazio alla Legenda
    const width = 850;
    const height = 600;
    const margin = { top: 40, right: 120, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 3. Creazione dell'elemento SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 4. Creazione delle Scale per X e Y basate sui valori della PCA
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d.pca_x))
        .range([0, innerWidth])
        .nice();

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d.pca_y))
        .range([innerHeight, 0])
        .nice();

    // 5. Scala dei colori STANDARD FORMULA 1 per le mescole
    const compounds = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"];
    const compoundColors = ["#ff3333", "#ffff00", "#ffffff", "#33cc33", "#0066ff"];
    
    const colorScale = d3.scaleOrdinal()
        .domain(compounds)
        .range(compoundColors);

    // 6. Creazione degli Assi
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .append("text")
        .attr("x", innerWidth / 2)
        .attr("y", 40)
        .attr("fill", "black")
        .style("font-size", "14px")
        .text("Componente Principale 1 (PCA X)");

    svg.append("g")
        .call(d3.axisLeft(yScale))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -30)
        .attr("fill", "black")
        .style("font-size", "14px")
        .text("Componente Principale 2 (PCA Y)");

    // 7. Creazione dinamica del Tooltip nel body
    let tooltip = d3.select("body").select(".d3-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "d3-tooltip")
            .style("position", "absolute")
            .style("opacity", 0)
            .style("background-color", "white")
            .style("border", "1px solid #666")
            .style("padding", "10px")
            .style("border-radius", "6px")
            .style("pointer-events", "none")
            .style("font-family", "sans-serif")
            .style("font-size", "13px")
            .style("box-shadow", "0px 4px 6px rgba(0,0,0,0.2)");
    }

    // 8. Disegno dei punti (Scatter) colorati per mescola
    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(+d.pca_x))
        .attr("cy", d => yScale(+d.pca_y))
        .attr("r", 5) // Raggio base
        .attr("fill", d => colorScale(d.Compound)) // Colore basato sulla mescola
        .attr("opacity", 0.8)
        .attr("stroke", "black") // Contorno nero utile soprattutto per le gomme bianche (HARD)
        .attr("stroke-width", 0.5)
        
        // Eventi per l'interazione col mouse
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("stroke-width", 2)
                .attr("opacity", 1)
                .attr("r", 8); // Il punto si ingrandisce

            tooltip.transition().duration(200).style("opacity", 0.95);
            tooltip.html(`
                <strong style="color:#0056b3;">Pilota:</strong> ${d.Driver} <br/>
                <strong>Giro:</strong> ${d.LapNumber} <br/>
                <strong>Tempo:</strong> ${d.LapTime_Sec}s <br/>
                <strong>Gomma:</strong> ${d.Compound} <br/>
                <strong>Cluster K-Means:</strong> ${d.kmeans_labels}
            `)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            d3.select(this)
                .attr("stroke-width", 0.5)
                .attr("opacity", 0.8)
                .attr("r", 5); // Il punto torna normale

            tooltip.transition().duration(500).style("opacity", 0);
        });

    // 9. Aggiunta della LEGENDA
    // Creiamo un gruppo per la legenda e lo posizioniamo fuori dal grafico a destra
    const legend = svg.append("g")
        .attr("transform", `translate(${innerWidth + 20}, 20)`);
    
    // Titolo della legenda
    legend.append("text")
        .attr("x", 0)
        .attr("y", -10)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "sans-serif")
        .text("Mescola:");

    // Disegniamo una voce per ogni mescola
    compounds.forEach((compound, i) => {
        const legendRow = legend.append("g")
            .attr("transform", `translate(0, ${i * 25})`); // Spaziatura verticale tra le voci

        // Il cerchietto colorato
        legendRow.append("circle")
            .attr("cx", 6)
            .attr("cy", 5)
            .attr("r", 6)
            .attr("fill", colorScale(compound))
            .attr("stroke", "black")
            .attr("stroke-width", 0.5);

        // Il testo con il nome della mescola
        legendRow.append("text")
            .attr("x", 20)
            .attr("y", 9)
            .attr("text-anchor", "start")
            .style("font-size", "12px")
            .style("font-family", "sans-serif")
            .text(compound);
    });
}