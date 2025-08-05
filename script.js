const destination = [50.1085, 14.5960]; 

const map = L.map('map').setView([50.095, 14.77], 10);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

let routePolyline = null;
let userMarker = null;
let currentRouteData = [];

function speakInstruction(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'cs-CZ';
    window.speechSynthesis.speak(utterance);
}

function drawRoute(route) {
    if (routePolyline) {
        map.removeLayer(routePolyline);
    }
    routePolyline = L.polyline(route, {
        color: 'blue',
        weight: 5
    }).addTo(map);
    map.fitBounds(routePolyline.getBounds());
}

async function recalculateRoute(startPoint) {
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${destination[1]},${destination[0]}?steps=true&alternatives=false&geometries=geojson`;

    try {
        const response = await fetch(osrmUrl);
        const data = await response.json();
        
        if (data.code === 'Ok') {
            const newRoute = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
            drawRoute(newRoute);
            
            currentRouteData = data.routes[0].legs[0].steps.map(step => ({
                lat: step.maneuver.location[1],
                lng: step.maneuver.location[0],
                instruction: step.maneuver.instruction
            }));
            speakInstruction("Přepočítávám trasu.");
            
            return currentRouteData;

        } else {
            console.error("OSRM API error:", data.message);
            speakInstruction("Nepodařilo se přepočítat trasu. Zkuste to prosím znovu.");
        }
    } catch (error) {
        console.error("Failed to fetch route:", error);
    }
}

async function onLocationFound(e) {
    const userLocation = e.latlng;

    if (!userMarker) {
        userMarker = L.marker(userLocation).addTo(map);
        map.setView(userLocation, 15);
        await recalculateRoute(userLocation);
    } else {
        userMarker.setLatLng(userLocation);
        map.setView(userLocation, 15);

        if (routePolyline) {
            const distance = L.GeometryUtil.distance(map, routePolyline, userLocation);
            
            if (distance > 50) {
                console.log("Jste mimo trasu, přepočítávám...");
                speakInstruction("Jste mimo trasu, přepočítávám.");
                await recalculateRoute(userLocation);
            }
        }
    }
}

function onLocationError(e) {
    alert(e.message);
}

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

map.locate({setView: false, maxZoom: 16, watch: true, enableHighAccuracy: true});