const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const port = process.env.PORT || 3000;


const logMemoryUsage = (id, message) => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024
  let msg = `${message ? (message + " | ") : ""}Mem.Usage:: ${Math.round(used * 100) / 100} MB ${id ? `-- en ${id}` : ''}`
  console.log(msg)
  return msg
}

app.post('/generar-mapa', async (req, res) => {

  const { width = 540, height = 540 } = req.body

  const { polygons = [] } = req.body

  if (polygons?.length === 0) res.status(400).json({
    ok: false,
    statusCode: 400,
    message: 'No se recibieron polígonos',
  })

  const polygonFeatures = polygons.map((polygon) => {
    const properties = { ...polygon }
    delete properties.coordinates
    return {
      "type": "Feature",
      "properties": properties,
      "geometry": {
        "type": "Polygon",
        "coordinates": polygon.coordinates || []
      }
    }
  })

  const browser = await puppeteer.launch({ width, height, headless: true });
  const page = await browser.newPage();
  logMemoryUsage('1', 'Antes de cargar el mapa')
  // Crear un mapa Leaflet en HTML
  const html = `
    <html>

    <head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
      <style>
        body {
          margin: 0;
        }
    
        #map {
          width: 100vw;
          height: 100vh;
        }

        .label {
          display:flex;
          text-align:center;
        }

        .footer {
          position: fixed;
          bottom: 0px;
          right: 0px;
          font-size: 12px;
          z-index: 1001;
          color: dodgerblue;
          background: white;
          padding:3px;
        }
      </style>
    </head>
    
    <body>
      <div class="footer">Yawi - Mj</div>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
      <script>
        const map = L.map('map', { fadeAnimation: false, zoomAnimation: false }).setView([0, 0], 2);
        L.tileLayer('http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ["mt0", "mt1", "mt2", "mt3"], }).addTo(map);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{ maxZoom: 17 }).addTo(map);
        
        // Remover controles innecesarios
        map.zoomControl.remove();

        // Generar polígonos aleatorios 
        var geojsonFeature = ${JSON.stringify(polygonFeatures)};
    
        // Dibujar polígonos en el mapa
        const drawnPolygons = L.geoJSON(geojsonFeature, {
          onEachFeature:  (feature, layer) => {

            layer.setStyle({
              color: feature.properties.border || '#000',
              fillColor: feature.properties.fill || '#000',
              fillOpacity: feature.properties.fillOpacity || 0.2,
              opacity: feature.properties.opacity || 1,
            })

            const label = L.marker(layer.getBounds().getCenter(), {
              icon: L.divIcon({
                className: 'label',
                html: feature.properties.label,
                iconSize: [feature.properties.label.length * 6.5, 20]
              })
            }).addTo(map);
          },
        }).addTo(map);
    
        // Ajustar el zoom del mapa para que se vean todos los polígonos
        map.fitBounds(drawnPolygons.getBounds());
    
      </script>
    </body>
    
    </html>
  `;

  await page.setContent(html);
  await page.waitForSelector('#map > div.leaflet-pane.leaflet-map-pane > div.leaflet-pane.leaflet-tile-pane > div.leaflet-layer:nth-child(1) > div:nth-child(1) > img')

  logMemoryUsage('2', 'Después de cargar el mapa')
  const screenshot = await page.screenshot();

  await browser.close();

  logMemoryUsage('3', 'Después de cerrar el navegador')
  // Devolver la imagen como respuesta
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': screenshot.length,
  });
  res.end(screenshot);
});

app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});
