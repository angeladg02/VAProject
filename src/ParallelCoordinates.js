import * as d3 from 'd3';

const COMPOUND_COLORS = {
    "SOFT": "#e10600",
    "MEDIUM": "#ffeb3b",
    "HARD": "#ffffff",
    "INTERMEDIATE": "#4caf50",
    "WET": "#2196f3",
    "UNKNOWN": "#888888"
};

export function drawParallelCoordinates(rawData, containerId, callbacks, selectedStints = []) {
    // 1. PULIZIA E PREPARAZIONE DATI
    const data = rawData.map(d => ({
        Driver: d.Driver || "Unknown",
        LapNumber: +d.LapNumber || 0,
        LapTime: +d.LapTimeSeconds || 0,
        Sector1Time: +d.Sector1Seconds || 0,
        Sector2Time: +d.Sector2Seconds || 0,
        Sector3Time: +d.Sector3Seconds || 0,
        TyreLife: +d.TyreLife || 0,
        Compound: d.Compound || "UNKNOWN",
        TrackTemp: +d.TrackTemp || 0,
        SpeedST: +d.SpeedST || 0
    })).filter(d => d.LapTime > 0 && d.Sector1Time > 0); // Filtra giri invalidi o out-lap senza tempi

    if (!data || data.length === 0) return;

    // Rimuoviamo gli outlier (es. giri di pit stop lentissimi) per non schiacciare le scale
    const p95Lap = d3.quantile(data.map(d => d.LapTime).sort(d3.ascending), 0.95);
    const validData = data.filter(d => d.LapTime <= p95Lap);

    // 2. SETUP CONTENITORE
    const container = d3.select(containerId);
    container.selectAll("*").remove();

    const containerNode = container.node();
    const width = containerNode.clientWidth || 800;
    const height = containerNode.clientHeight || 300;
    
    const margin = { top: 30, right: 50, bottom: 20, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3. DEFINIZIONE DELLE DIMENSIONI (Assi)
    const dimensions = [
        "LapTime", "Sector1Time", "Sector2Time", "Sector3Time", 
        "TyreLife", "Compound", "TrackTemp", "SpeedST"
    ];

    // 4. CREAZIONE DELLE SCALE PER OGNI ASSE
    const y = {};
    dimensions.forEach(dim => {
        if (dim === "Compound") {
            // Asse Categorico
            const compounds = Array.from(new Set(validData.map(d => d[dim])));
            y[dim] = d3.scalePoint()
                .domain(compounds)
                .range([innerHeight, 0])
                .padding(0.5);
        } else if (dim === "LapTime") {
            // Asse LapTime INVERTITO (tempi bassi/veloci in alto, tempi alti/lenti in basso)
            y[dim] = d3.scaleLinear()
                .domain(d3.extent(validData, d => d[dim]))
                .range([0, innerHeight]); 
        } else {
            // Assi Numerici standard (valori alti in alto)
            y[dim] = d3.scaleLinear()
                .domain(d3.extent(validData, d => d[dim]))
                .range([innerHeight, 0]);
        }
    });

    // Scala X per posizionare gli assi orizzontalmente
    const x = d3.scalePoint()
        .range([0, innerWidth])
        .padding(0.5)
        .domain(dimensions);

    // 5. DISEGNO DELLE LINEE (Giri)
    const lineGenerator = d => d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));

    const tooltip = d3.select("#tooltip");

    const lines = g.append("g")
        .attr("class", "lines")
        .selectAll("path")
        .data(validData)
        .enter()
        .append("path")
        .attr("d", lineGenerator)
        .style("fill", "none")
        .style("stroke", d => COMPOUND_COLORS[d.Compound] || COMPOUND_COLORS["UNKNOWN"])
        .style("stroke-width", 1)
        .style("opacity", 0.15) // Opacità bassa di default come da specifiche
        .style("transition", "opacity 0.2s")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .style("stroke-width", 3)
                .style("opacity", 1)
                .raise(); // Porta in primo piano
            
            tooltip.classed("hidden", false)
                .html(`
                    <div style="margin-bottom:5px;"><strong>${d.Driver}</strong> - Lap ${d.LapNumber}</div>
                    <div>Compound: <strong style="color:${COMPOUND_COLORS[d.Compound]}">${d.Compound}</strong></div>
                    <div>Lap Time: ${d.LapTime.toFixed(3)}s</div>
                    <div>Tyre Life: ${d.TyreLife}</div>
                    <div>SpeedST: ${d.SpeedST} km/h</div>
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("stroke-width", 1)
                .style("opacity", d => (isLineActive(d) ? 0.8 : 0.15)); // Ripristina l'opacità in base al brush
            tooltip.classed("hidden", true);
        });

    // 6. DISEGNO DEGLI ASSI E BRUSHING
    const axes = g.selectAll(".axis")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)},0)`)
        .each(function(d) { 
            // Disegna l'asse Y specifico per quella dimensione
            d3.select(this).call(d3.axisLeft().scale(y[d]).ticks(5)); 
        });

    // Colora i testi degli assi di bianco/grigio per il tema scuro
    axes.selectAll("text").style("fill", "#f5f5f5").style("font-size", "10px");
    axes.selectAll("path, line").style("stroke", "#888894");

    // Aggiungi i titoli degli assi
    axes.append("text")
        .style("text-anchor", "middle")
        .attr("y", -15)
        .text(d => d)
        .style("fill", "#f5f5f5")
        .style("font-weight", "bold")
        .style("font-size", "11px")
        .style("cursor", "ew-resize");

    // 7. LOGICA DI BRUSHING (Filtro multidimensionale)
    const selections = new Map(); // Tiene traccia dei range selezionati su ogni asse

    axes.append("g")
        .attr("class", "brush")
        .each(function(d) {
            d3.select(this).call(y[d].brush = d3.brushY()
                .extent([[-10, 0], [10, innerHeight]])
                .on("start brush end", brushed)
            );
        });

    function brushed({selection}, dim) {
        if (selection === null) {
            selections.delete(dim); // Se clicchi fuori, rimuove il filtro per questo asse
        } else {
            // Mappa i pixel del brush ai valori dei dati invertendo la scala
            if (dim === "Compound") {
                // Per la scala categorica, calcola la vicinanza
                const domain = y[dim].domain();
                const range = domain.map(d => y[dim](d));
                const selectedCompounds = domain.filter((d, i) => selection[0] <= range[i] && range[i] <= selection[1]);
                selections.set(dim, selectedCompounds);
            } else {
                selections.set(dim, selection.map(y[dim].invert));
            }
        }
        updateLines();
    }

    function isLineActive(d) {
        // Controlla se una linea passa attraverso TUTTI i brush attivi
        for (let [dim, sel] of selections) {
            if (dim === "Compound") {
                if (!sel.includes(d[dim])) return false;
            } else {
                // Gestisce il fatto che per alcuni assi la scala è invertita
                const min = Math.min(sel[0], sel[1]);
                const max = Math.max(sel[0], sel[1]);
                if (d[dim] < min || d[dim] > max) return false;
            }
        }
        return true;
    }

    function updateLines() {
        lines.style("opacity", d => {
            if (selections.size === 0) return 0.15; // Nessun filtro
            return isLineActive(d) ? 0.8 : 0.02; // Evidenzia chi passa il filtro, sbiadisce gli altri
        })
        .style("stroke-width", d => (selections.size > 0 && isLineActive(d) ? 2 : 1));

        // EVENTUALE TRIGGER PER ALTRE VISTE
        // if (callbacks && callbacks.onPCPFilter) {
        //     const activeData = validData.filter(isLineActive);
        //     callbacks.onPCPFilter(activeData);
        // }
    }
}